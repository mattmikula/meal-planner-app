import type { ReactNode } from "react";

import styles from "./Card.module.css";

type CardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "compact";
};

export default function Card({ children, className, variant = "default" }: CardProps) {
  const variantClass = variant === "compact" ? styles.compact : undefined;
  const classes = [styles.card, variantClass, className].filter(Boolean).join(" ");

  return <div className={classes}>{children}</div>;
}
