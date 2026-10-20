import socials from "~/assets/socials";

export default defineAppConfig({
  socials,
  ui: {
    colors: {
      primary: "primary",
      neutral: "zinc",
      info: "blue",
      success: "green",
      warning: "orange",
      error: "red"
    },
    button: {
      slots: {
        base: "cursor-pointer ui-btn",
        icon: "size-4!",
        trailingIcon: "size-4!",
        leadingIcon: "size-5!"
      },
      compoundVariants: [
        {
          color: "secondary",
          variant: "soft",
          class: "dark:bg-secondary-700 text-secondary-300"
        }
      ]
    },
    skeleton: {
      base: "bg-sand-dark dark:bg-elevated"
    },
    navigationMenu: {
      slots: {
        linkLeadingIcon: "size-4 -translate-y-px"
      }
    },
    formField: {
      slots: {
        root: "form-field flex-1",
        error: "text-sm",
        label: "hidden"
      }
    },
    input: {
      slots: {
        base: "select-none",
        root: "w-full input"
      },
      variants: {
        variant: {
          outline: "dark:bg-neutral-950"
        },
        size: {
          xl: { base: "text-sm py-3", label: "text-sm", item: "text-xs" }
        }
      }
    }
  }
});
