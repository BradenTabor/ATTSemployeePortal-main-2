import { useMemo } from 'react';
import { lookupMAD, COMMON_VOLTAGES } from '../../data/madReferenceTable';
import { useCrewQualifications } from '../queries/useWorkerQualifications';

export function useElectricalHazards(
  voltageKV: number,
  crewMemberIds: string[]
) {
  const mad = useMemo(() => lookupMAD(voltageKV), [voltageKV]);
  const crewQuals = useCrewQualifications(crewMemberIds);
  const hasUnqualified = crewMemberIds.some(
    (id) => (crewQuals.data?.[id] ?? 'unqualified') === 'unqualified'
  );
  const crewQualificationIssues = useMemo(() => {
    if (!crewQuals.data) return [];
    return crewMemberIds.filter((id) => (crewQuals.data?.[id] ?? 'unqualified') === 'unqualified');
  }, [crewQuals.data, crewMemberIds]);

  return {
    mad,
    commonVoltages: COMMON_VOLTAGES,
    crewQualifications: crewQuals.data ?? {},
    crewQualificationIssues,
    hasUnqualified,
    isLoadingCrew: crewQuals.isLoading,
  };
}
