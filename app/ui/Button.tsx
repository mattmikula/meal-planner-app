import type { ComponentPropsWithoutRef } from "react";

import styles from "./Button.module.css";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
};

const VARIANT_CLASS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost
};

export default function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.button, VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}
