"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";

type Name = { name: string; hasDepartments: boolean; hideInList: boolean };
type Institution = { code: string; names: Name[]; id: string; isCommunityCollege: boolean; beginId: string };
type AgreementInstitution = { code?: string; institutionName?: string; isCommunityCollege: boolean; sendingYearIds?: string[]; id?: string; academicYearId?: string; receivingYearIds?: string[] };
type Agreement = { label: string; key: string };
type Agreements = { reports?: Agreement[] };
type Course = { label: string };
type Major = { label: string; courses: Course[] };

const api = axios.create({ baseURL: "/assist" });

const toTitleCase = (str: string) =>
  str.replace(/\w\S*/g, (word) =>
    /^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$/.test(word)
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );

export default function Home() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutions_filtered, setInstitutionsFiltered] = useState<Institution[]>([]);
  const [selectedSystem, setSelectedSystem] = useState("California Polytechnic University");
  const [selectedInstitution, setSelectedInstitution] = useState("California Polytechnic University, San Luis Obispo");
  const [institutionsWithAgreements, setInstitutionsWithAgreements] = useState<AgreementInstitution[]>([]);
  const [majors, setMajors] = useState<string[]>([]);
  const [selectedMajor, setSelectedMajor] = useState("");
  const [query, setQuery] = useState("");

  const filteredMajors = useMemo(
    () =>
      !query.trim()
        ? majors
        : majors.filter((m) => m.toLowerCase().includes(query.toLowerCase())),
    [majors, query]
  );

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const { data } = await api.get<Institution[]>("/api/institutions", { signal: controller.signal });
        setInstitutions(data);

        const filtered = data
          .filter((inst) => !inst.isCommunityCollege)
          .filter((inst) => inst.names.some((n) => n.name.includes("California Polytechnic University")));
        setInstitutionsFiltered(filtered);

        //  Cal Poly SLO (id "11") default
        await getAndSetInstitutionAgreements("11", data, controller.signal);
      } catch (err) {
        if (!axios.isCancel(err)) console.error("Fetch institutions failed:", err);
      }
    })();

    return () => controller.abort();
  }, []);

  const getAndSetInstitutionAgreements = async (institutionId: string, schools: Institution[], signal?: AbortSignal) => {
    try {

      const { data } = await api.get<AgreementInstitution[]>(`/api/institutions/${institutionId}/agreements`, { signal });

      const agreements = data.map((school) => {
        const { institutionName = "", isCommunityCollege, sendingYearIds, receivingYearIds } = school;
        const id = schools.find((inst) => inst.names.some((n) => n.name.includes(institutionName)))?.id;
        const academicYearId = sendingYearIds?.at(-1) ?? receivingYearIds?.at(-1);
        return { id, isCommunityCollege, academicYearId };
      });

      setInstitutionsWithAgreements(agreements);

      const reqs = agreements.map(async ({ id, academicYearId }) => {
        if (!id || !academicYearId) return [] as string[];

        const { data: majorsResp } = await api.get<Agreements>("/api/agreements", {
          params: {
            receivingInstitutionId: institutionId,
            sendingInstitutionId: id,
            academicYearId,
            categoryCode: "major",
          },
          signal,
        });

        const reports = majorsResp.reports ?? [];
        return reports.map((r) => toTitleCase((r.label ?? "").trim()));
      });

      const settled = await Promise.allSettled(reqs);
      const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

      const unique = [...new Map(all.map((m) => [m.toLowerCase().trim(), m.trim()])).values()].sort();

      setMajors(unique);
      setSelectedMajor(unique[0] ?? "");
    } catch (err) {
      if (!axios.isCancel(err)) console.error("Fetch agreements failed:", err);
    }
  };

  const setSystemInstitutions = (name: string) => {
    setInstitutionsFiltered(
      institutions
        .filter((inst) => !inst.isCommunityCollege)
        .filter((inst) => inst.names.some((n) => n.name.includes(name)))
    );
  };

  const onSystemChange = (name: string) => {
    setSystemInstitutions(name);
  };

  const handleSystemSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    setMajors([]);
    setSelectedMajor("");
    setQuery("");
    setSelectedInstitution("");

    setSelectedSystem(value);
    onSystemChange(value);
  };

  const handleInstitutionSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    setSelectedInstitution(value);
    setMajors([]);
    setSelectedMajor("");
    setQuery("");

    await getAndSetInstitutionAgreements(value, institutions);
  };

  const handleMajorPick = (major: string) => {
    setSelectedMajor(major);
    setQuery("");
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-start justify-items-start min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="">
        <h1 className="text-3xl font-bold">Reverse Assist 2.0</h1>
        <div className="gap-[32px] border-r-2 min-w-[40vw] w-full">
          <div>
            <div className="flex">
              <strong>Select a California School System: </strong>
              <select value={selectedSystem} onChange={handleSystemSelect}>
                <option>California Polytechnic University</option>
                <option>California State University</option>
                <option>University of California</option>
              </select>
            </div>

            <div className="flex items-center gap-x-3 w-full">
              <strong>Select an Institution: </strong>
              {institutions_filtered.length > 0 && (
                <select value={selectedInstitution} onChange={handleInstitutionSelect}>
                  {institutions_filtered.map((institution: Institution) => (
                    <option key={institution.code} value={institution.id}>
                      {institution.names.find((n) => n.name.includes(selectedSystem))?.name.toString()}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-x-3 w-full max-h-[25vw]">
            <strong>Select a Major: </strong>
            {majors.length > 0 && (
              <div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  placeholder={`🔍 ${selectedMajor}`}
                  onFocus={(e) => (e.currentTarget.placeholder = "🔍")}
                  onBlur={(e) => (e.currentTarget.placeholder = `🔍 ${selectedMajor}`)}
                  className="w-full bg-white placeholder-black placeholder:italic border-b-1 p-1 -m-1 outline-none transition hover:ring-2 hover:ring-purple-500/70 hover:drop-shadow-[0_0_10px_rgba(168,85,247,0.55)] focus:ring-2 focus:ring-purple-500 focus:drop-shadow-[0_0_10px_rgba(168,85,247,0.65)] focus:ring-offset-1"
                />
                <ul className="overflow-auto max-h-full my-1">
                  {filteredMajors.map((major, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => handleMajorPick(major)}
                        className={`block w-full text-left px-3 py-2 hover:cursor-pointer hover:bg-gray-100 ${
                          selectedMajor === major ? "hidden" : ""
                        }`}
                      >
                        {major}
                      </button>
                    </li>
                  ))}
                  {filteredMajors.length === 0 && <li className="px-3 py-2 text-gray-500">No matches</li>}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-10 flex gap-x-3 w-full max-h-[25vw]">
            <strong>Select a Course: </strong>
          </div>
        </div>
      </main>
    </div>
  );
}
