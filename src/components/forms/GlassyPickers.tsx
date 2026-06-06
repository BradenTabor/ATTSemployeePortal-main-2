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
type PickerVariant = "emerald" | "ember" | "gold";

// Theme configurations for different variants
const VARIANT_STYLES = {
  emerald: {
    iconColor: "text-emerald-300",
    focusRing: "focus-visible:ring-emerald-400/70",
    shadow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    background: "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 1) 0%, rgba(21, 96, 60, 1) 100%)",
    helperHighlight: "text-emerald-200",
    badge: "text-emerald-200",
    border: "border-white/10",
    hoverBorder: "hover:border-emerald-500/30",
  },
  ember: {
    iconColor: "text-amber-400",
    focusRing: "focus-visible:ring-amber-500/50",
    shadow: "shadow-[0_0_20px_rgba(245,158,11,0.12)]",
    background: "linear-gradient(135deg, rgba(10, 5, 2, 1) 0%, rgba(80, 40, 15, 1) 50%, rgba(40, 20, 5, 1) 100%)",
    helperHighlight: "text-amber-300",
    badge: "text-amber-300",
    border: "border-amber-500/25",
    hoverBorder: "hover:border-amber-400/40",
  },
  gold: {
    iconColor: "text-[#f4c979]",
    focusRing: "focus-visible:ring-[#f4c979]/60",
    shadow: "shadow-[0_0_20px_rgba(244,201,121,0.15)]",
    background: "radial-gradient(ellipse at 30% 30%, rgba(27, 25, 20, 0.95) 0%, rgba(12, 10, 8, 1) 60%, rgba(7, 6, 5, 1) 100%)",
    helperHighlight: "text-[#f6dcb2]",
    badge: "text-[#f4c979]",
    border: "border-[#f4c979]/30",
    hoverBorder: "hover:border-[#f4c979]/50",
  },
};

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
  variant?: PickerVariant;
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
      variant = "emerald",
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
    
    // Get theme styles based on variant
    const theme = VARIANT_STYLES[variant];

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    };

    return (
      <div className={cn("space-y-1 sm:space-y-2", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "text-xs sm:text-sm font-medium text-white/80 tracking-wide",
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        <div className="relative group">
          <div className={cn("pointer-events-none absolute left-3 sm:left-4 top-1/2 -translate-y-1/2", theme.iconColor)}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <input
            {...rest}
            id={inputId}
            ref={ref}
            type={pickerType}
            onChange={handleChange}
            className={cn(
              "w-full rounded-xl sm:rounded-2xl border px-9 sm:px-12 py-2 sm:py-3 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:border-transparent transition-all [color-scheme:dark]",
              theme.border,
              theme.hoverBorder,
              theme.focusRing,
              theme.shadow,
              className
            )}
            style={{
              background: theme.background,
            }}
          />
          {value && pickerType === "time" && (
            <div className={cn("pointer-events-none absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 text-[0.5rem] sm:text-[0.6rem] uppercase tracking-[0.3em]", theme.badge)}>
              24H
            </div>
          )}
        </div>
        {(helperText || formattedValue) && (
          <p className="text-[10px] sm:text-xs text-gray-400">
            {formattedValue ? (
              <>
                <span className={cn("font-semibold", theme.helperHighlight)}>
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
  variant?: PickerVariant;
};

export const DateField = forwardRef<HTMLInputElement, PickerProps>(
  ({ displayValueFormatter = defaultDateFormatter, variant = "emerald", ...rest }, ref) => (
    <BasePicker
      ref={ref}
      pickerType="date"
      displayValueFormatter={displayValueFormatter}
      variant={variant}
      {...rest}
    />
  )
);

DateField.displayName = "DateField";

export const TimeField = forwardRef<HTMLInputElement, PickerProps>(
  ({ displayValueFormatter = defaultTimeFormatter, variant = "emerald", ...rest }, ref) => (
    <BasePicker
      ref={ref}
      pickerType="time"
      displayValueFormatter={displayValueFormatter}
      variant={variant}
      {...rest}
    />
  )
);

TimeField.displayName = "TimeField";

