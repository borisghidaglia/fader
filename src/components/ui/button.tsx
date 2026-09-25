import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// X's buttons: pills with bold labels. White is the main action, outlined the rest.
// Each variant sets its own border colour: links use buttonVariants without cn, so a
// colour in the base would clash with the outline's instead of being replaced.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border bg-clip-padding font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-[#d7dbdc]",
        signal: "border-transparent bg-signal text-white hover:bg-signal-hover",
        outline: "border-[#536471] bg-transparent text-foreground hover:bg-hover aria-expanded:bg-hover",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-hover",
        ghost: "border-transparent hover:bg-hover aria-expanded:bg-hover",
        destructive: "border-[#67070f] text-destructive hover:bg-destructive/10",
        link: "border-transparent text-signal hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 text-[15px]",
        xs: "h-7 gap-1 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-4 text-sm",
        lg: "h-[52px] gap-2 px-8 text-[17px]",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-[34px] [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-lg": "size-10 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
