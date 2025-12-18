import { forwardRef, useId } from "react";
import type {
  ChangeEventHandler,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { Calendar, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

type PickerValueFormatter = (value: string) => string;

interface BasePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: ReactNode;
  helperText?: string;
  labelClassName?: string;
  containerClassName?: string;
  icon?: ComponentType<{ className?: string }>;
  onValueChange?: (value: string) => void;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  displayValueFormatter?: PickerValueFormatter;
}

type PickerType = "date" | "time" | "datetime-local";

interface InternalPickerProps extends BasePickerProps {
  pickerType: PickerType;
}

const BasePicker = forwardRef<HTMLInputElement, InternalPickerProps>(
  (
    {
      label,
      helperText,
      containerClassName,
      labelClassName,
      icon: IconOverride,
      onValueChange,
      onChange,
      displayValueFormatter,
      className,
      pickerType,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = rest.id ?? generatedId;
    const Icon = IconOverride || (pickerType === "time" ? Clock : Calendar);
    const value =
      typeof rest.value === "string" ? rest.value : rest.value?.toString();
    const formattedValue =
      value && displayValueFormatter ? displayValueFormatter(value) : undefined;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    };

    return (
      <div className={cn("space-y-2", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "text-sm font-medium text-white/80 tracking-wide",
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        <div className="relative group">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300">
            <Icon className="h-4 w-4" />
          </div>
          <input
            {...rest}
            id={inputId}
            ref={ref}
            type={pickerType}
            onChange={handleChange}
            className={cn(
              "w-full rounded-2xl border border-white/10 px-12 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:border-transparent transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] [color-scheme:dark]",
              className
            )}
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 1) 0%, rgba(21, 96, 60, 1) 100%)',
            }}
          />
          {value && pickerType === "time" && (
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.6rem] uppercase tracking-[0.3em] text-emerald-200">
              24H
            </div>
          )}
        </div>
        {(helperText || formattedValue) && (
          <p className="text-xs text-gray-400">
            {formattedValue ? (
              <>
                <span className="text-emerald-200 font-semibold">
                  {formattedValue}
                </span>
                {helperText ? ` • ${helperText}` : ""}
              </>
            ) : (
              helperText
            )}
          </p>
        )}
      </div>
    );
  }
);

BasePicker.displayName = "BasePicker";

const defaultDateFormatter: PickerValueFormatter = (value) => {
  try {
    const [datePart] = value.split("T");
    if (!datePart) return value;
    const [yearStr, monthStr, dayStr] = datePart.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return value;
    }
    const uiDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(uiDate);
  } catch {
    return value;
  }
};

const defaultTimeFormatter: PickerValueFormatter = (value) => {
  try {
    const [hour, minute] = value.split(":").map(Number);
    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return value;
    }
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
};

type PickerProps = BasePickerProps & {
  displayValueFormatter?: PickerValueFormatter;
};

export const DateField = forwardRef<HTMLInputElement, PickerProps>(
  ({ displayValueFormatter = defaultDateFormatter, ...rest }, ref) => (
    <BasePicker
      ref={ref}
      pickerType="date"
      displayValueFormatter={displayValueFormatter}
      {...rest}
    />
  )
);

DateField.displayName = "DateField";

export const TimeField = forwardRef<HTMLInputElement, PickerProps>(
  ({ displayValueFormatter = defaultTimeFormatter, ...rest }, ref) => (
    <BasePicker
      ref={ref}
      pickerType="time"
      displayValueFormatter={displayValueFormatter}
      {...rest}
    />
  )
);

TimeField.displayName = "TimeField";

