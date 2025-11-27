interface ButtonLinkProps {
  label: string;
  href: string;
}

export default function ButtonLink({ label, href }: ButtonLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full bg-green-600 text-white text-center py-5 sm:py-6 px-6 rounded-xl font-semibold text-lg sm:text-xl shadow-lg hover:bg-green-700 hover:shadow-xl active:scale-95 transition-all duration-200 touch-manipulation min-h-[60px]"
    >
      {label}
    </a>
  );
}
