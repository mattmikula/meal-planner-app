import type { ComponentPropsWithoutRef } from "react";

import styles from "./FormControls.module.css";

type TextInputProps = ComponentPropsWithoutRef<"input">;

export default function TextInput({ className, ...props }: TextInputProps) {
  const classes = [styles.input, className].filter(Boolean).join(" ");

  return <input className={classes} {...props} />;
}
