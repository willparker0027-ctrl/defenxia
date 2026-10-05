import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "defenxia-toast",
          description: "defenxia-toast-description",
          actionButton: "defenxia-toast-action",
          cancelButton: "defenxia-toast-cancel",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
