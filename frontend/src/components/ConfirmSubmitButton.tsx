"use client";

interface ConfirmSubmitButtonProps {
  message: string;
  children: React.ReactNode;
  className?: string;
}

export default function ConfirmSubmitButton({
  message,
  children,
  className,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
