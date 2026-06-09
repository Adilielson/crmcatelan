import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-[#1A1A1A] group-[.toaster]:border-[#E5E7EB] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[#6B7280]",
          actionButton: "group-[.toast]:bg-[#FFC400] group-[.toast]:text-[#1a1500]",
          cancelButton: "group-[.toast]:bg-[#F6F7F9] group-[.toast]:text-[#6B7280]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
