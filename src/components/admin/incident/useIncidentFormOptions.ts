import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { formToast } from "../../../lib/formToast";
import { logger } from "../../../lib/logger";
import type { WorkSite, Employee, JobOption, CrewOption } from "./constants";

export function useIncidentFormOptions(isOpen: boolean) {
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [crews, setCrews] = useState<CrewOption[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const [sitesResult, jobsResult, crewsResult, employeesResult] = await Promise.all([
          supabase
            .from('work_sites')
            .select('id, name')
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('job_progress_trackers')
            .select('id, circuit, job_location, crew_id, start_date, end_date')
            .in('status', ['scheduled', 'in_progress', 'completed'])
            .order('start_date', { ascending: false })
            .limit(200),
          supabase
            .from('crews')
            .select('id, name')
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('app_users')
            .select('user_id, full_name, role')
            .not('full_name', 'is', null)
            .order('full_name'),
        ]);

        if (cancelled) return;

        if (sitesResult.data) setWorkSites(sitesResult.data);
        if (jobsResult.data) setJobs(jobsResult.data);
        if (crewsResult.data) setCrews(crewsResult.data);
        if (employeesResult.data) {
          setEmployees(
            employeesResult.data.filter(
              (emp) => emp.full_name && emp.full_name.trim().length > 0
            )
          );
        }
      } catch (error) {
        logger.error('Error fetching incident form options:', error);
        formToast.error('Load Failed', 'Failed to load form options. Some fields may not work correctly.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchOptions();
    return () => { cancelled = true; };
  }, [isOpen]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const searchLower = employeeSearch.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.full_name?.toLowerCase().includes(searchLower) ||
        emp.role?.toLowerCase().includes(searchLower)
    );
  }, [employees, employeeSearch]);

  return {
    workSites,
    jobs,
    crews,
    employees,
    filteredEmployees,
    isLoading,
    employeeSearch,
    setEmployeeSearch,
  };
}
