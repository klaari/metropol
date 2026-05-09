import { type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Text } from "./Text";

interface BaseProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

interface ButtonRowProps extends BaseProps {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  href?: undefined;
}

interface LinkRowProps extends BaseProps {
  href: string;
  onClick?: undefined;
}

type ListRowProps = ButtonRowProps | LinkRowProps;

function Body({ title, subtitle, leading, trailing }: BaseProps) {
  return (
    <div className="flex items-center gap-md min-h-14 px-lg w-full">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="flex-1 min-w-0">
        <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function ListRow(props: ListRowProps) {
  const body = (
    <Body
      title={props.title}
      subtitle={props.subtitle}
      leading={props.leading}
      trailing={props.trailing}
    />
  );

  const interactiveClass =
    "block w-full text-left hover:bg-paper-sunken transition-colors";

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={interactiveClass}>
        {body}
      </Link>
    );
  }

  if ("onClick" in props && props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className={interactiveClass}>
        {body}
      </button>
    );
  }

  return <div>{body}</div>;
}
