// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import Select from "@/app/ui/Select";
import TextArea from "@/app/ui/TextArea";
import TextInput from "@/app/ui/TextInput";
import buttonStyles from "@/app/ui/Button.module.css";
import cardStyles from "@/app/ui/Card.module.css";
import formStyles from "@/app/ui/FormControls.module.css";

afterEach(() => {
  cleanup();
});

test("Button applies the variant class", () => {
  render(<Button variant="ghost">Ghost</Button>);

  const button = screen.getByRole("button", { name: "Ghost" });
  expect(button).toHaveClass(buttonStyles.ghost);
});

test("Button merges custom className", () => {
  render(<Button className="extra">Click</Button>);

  const button = screen.getByRole("button", { name: "Click" });
  expect(button).toHaveClass(buttonStyles.button);
  expect(button).toHaveClass("extra");
});

test("Button forwards props", () => {
  render(<Button disabled>Disabled</Button>);

  const button = screen.getByRole("button", { name: "Disabled" });
  expect(button).toBeDisabled();
});

test("TextInput merges custom className", () => {
  render(<TextInput aria-label="Email" className="extra" />);

  const input = screen.getByLabelText("Email");
  expect(input).toHaveClass(formStyles.input);
  expect(input).toHaveClass("extra");
});

test("TextInput forwards props", () => {
  render(<TextInput aria-label="Email" placeholder="you@example.com" />);

  const input = screen.getByLabelText("Email");
  expect(input).toHaveAttribute("placeholder", "you@example.com");
});

test("TextArea merges custom className", () => {
  render(<TextArea aria-label="Notes" className="extra" />);

  const textarea = screen.getByLabelText("Notes");
  expect(textarea).toHaveClass(formStyles.textarea);
  expect(textarea).toHaveClass("extra");
});

test("TextArea forwards props", () => {
  render(<TextArea aria-label="Notes" rows={5} />);

  const textarea = screen.getByLabelText("Notes");
  expect(textarea).toHaveAttribute("rows", "5");
});

test("Select merges custom className", () => {
  render(
    <Select aria-label="Meals" className="extra">
      <option value="one">One</option>
    </Select>
  );

  const select = screen.getByLabelText("Meals");
  expect(select).toHaveClass(formStyles.select);
  expect(select).toHaveClass("extra");
});

test("Select forwards props", () => {
  render(
    <Select aria-label="Meals" name="meal">
      <option value="one">One</option>
    </Select>
  );

  const select = screen.getByLabelText("Meals");
  expect(select).toHaveAttribute("name", "meal");
});

test("Card applies the compact variant class", () => {
  render(<Card variant="compact">Card</Card>);

  const card = screen.getByText("Card");
  expect(card).toHaveClass(cardStyles.card);
  expect(card).toHaveClass(cardStyles.compact);
});

test("Card merges custom className", () => {
  render(<Card className="extra">Card</Card>);

  const card = screen.getByText("Card");
  expect(card).toHaveClass(cardStyles.card);
  expect(card).toHaveClass("extra");
});
