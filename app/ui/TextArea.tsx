import type { ComponentPropsWithoutRef } from "react";

import styles from "./FormControls.module.css";

type TextAreaProps = ComponentPropsWithoutRef<"textarea">;

export default function TextArea({ className, ...props }: TextAreaProps) {
  const classes = [styles.textarea, className].filter(Boolean).join(" ");

  return <textarea className={classes} {...props} />;
}
