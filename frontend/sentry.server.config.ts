// Node.js runtime Sentry init, loaded from src/instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "./src/lib/sentry-options";

Sentry.init(sentryOptions);
