import { t } from "./i18n";
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { explanations, type HelpTopic } from "./learning";
import styles from "./Learning.module.css";

export function ContextHelp({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  function show() {
    const rect = button.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(12, Math.min(rect.right - 265, window.innerWidth - 277)),
        top: Math.max(12, Math.min(rect.bottom, window.innerHeight - 312)),
      });
    setOpen(true);
  }
  const entry = explanations[topic];
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    const dismiss = () => {
      setOpen(false);
      setPinned(false);
    };
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);
  return (
    <span
      ref={wrapper}
      className={styles.help}
      onMouseEnter={show}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setPinned(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={styles.helpButton}
        aria-label={t`Hilfe: ${entry.title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          if (next) show();
          else setOpen(false);
        }}
        onBlur={(event) => {
          if (!wrapper.current?.contains(event.relatedTarget as Node)) {
            setOpen(false);
            setPinned(false);
          }
        }}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          className={styles.helpBody}
          role="note"
          style={
            {
              "--help-left": `${position.left}px`,
              "--help-top": `${position.top}px`,
            } as CSSProperties
          }
        >
          <strong>{entry.title}</strong>
          <span>{entry.detail}</span>
        </span>
      )}
    </span>
  );
}

export function Term({
  topic,
  children,
}: {
  topic: HelpTopic;
  children: ReactNode;
}) {
  return (
    <span className={styles.term}>
      {children}
      <ContextHelp topic={topic} />
    </span>
  );
}

export function Field({
  label,
  topic,
  children,
}: {
  label: string;
  topic: HelpTopic;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <div className={styles.fieldHeading}>
        <label htmlFor={id}>{label}</label>
        <ContextHelp topic={topic} />
      </div>
      {cloneElement(children, { id, "aria-describedby": `${id}-hint` })}
      <small id={`${id}-hint`}>{explanations[topic].short}</small>
    </div>
  );
}
