/* @ts-nocheck */

import { type FC, memo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";

export const MemoizedReactMarkdown: FC<Options> = memo(
  ReactMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    // @ts-expect-error - className is not typed
    prevProps.className === nextProps.className,
);
