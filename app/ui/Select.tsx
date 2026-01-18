import type { ComponentPropsWithoutRef } from "react";

import styles from "./FormControls.module.css";

type SelectProps = ComponentPropsWithoutRef<"select">;

export default function Select({ className, ...props }: SelectProps) {
  const classes = [styles.select, className].filter(Boolean).join(" ");

  return <select className={classes} {...props} />;
}
