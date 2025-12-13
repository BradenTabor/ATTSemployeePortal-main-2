import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobFormSchema, type JobFormData } from '../../schemas/jobs';
import { FormField } from './FormField';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { toast } from '../../lib/toast';

interface ExampleJobFormProps {
  initialData?: Partial<JobFormData>;
  onSubmit: (data: JobFormData) => Promise<void>;
  onCancel: () => void;
}

/**
 * Example form implementation using React Hook Form + Zod
 * Use this as a reference for creating new forms
 */
export function ExampleJobForm({ initialData, onSubmit, onCancel }: ExampleJobFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JobFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(jobFormSchema as any),
    mode: 'onBlur',
    defaultValues: {
      job_name: '',
      job_location: '',
      job_description: '',
      start_date: '',
      end_date: '',
      notes: '',
      milestones: [],
      crew_member_ids: [],
      ...initialData,
    },
  });

  const onFormSubmit = async (data: JobFormData) => {
    try {
      await onSubmit(data);
      toast.success('Job saved successfully');
    } catch {
      toast.error('Failed to save job');
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <FormField label="Job Name" error={errors.job_name?.message} required>
        <Input
          {...register('job_name')}
          placeholder="Enter job name"
          error={!!errors.job_name}
        />
      </FormField>

      <FormField label="Location" error={errors.job_location?.message}>
        <Input
          {...register('job_location')}
          placeholder="Enter location"
          error={!!errors.job_location}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Start Date" error={errors.start_date?.message} required>
          <Input
            type="date"
            {...register('start_date')}
            error={!!errors.start_date}
          />
        </FormField>

        <FormField label="End Date" error={errors.end_date?.message} required>
          <Input
            type="date"
            {...register('end_date')}
            error={!!errors.end_date}
          />
        </FormField>
      </div>

      <FormField label="Description" error={errors.job_description?.message}>
        <Textarea
          {...register('job_description')}
          placeholder="Enter job description"
          rows={4}
          error={!!errors.job_description}
        />
      </FormField>

      <FormField label="Notes" error={errors.notes?.message}>
        <Textarea
          {...register('notes')}
          placeholder="Additional notes"
          rows={3}
          error={!!errors.notes}
        />
      </FormField>

      <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-3 rounded-2xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] font-semibold disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Job'}
        </button>
      </div>
    </form>
  );
}

