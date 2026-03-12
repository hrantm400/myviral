import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp, source, error }) => {
  const ts = new Date(timestamp as string).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  let logMessage = `${ts} `;
  if (source) {
    logMessage += `[${source}] `;
  }
  logMessage += `${level}: ${message}`;

  if (error) {
    if (error instanceof Error && error.stack) {
      logMessage += `\n${error.stack}`;
    } else {
      logMessage += `\n${JSON.stringify(error, null, 2)}`;
    }
  }

  return logMessage;
});

export const logger = winston.createLogger({
  level: "info",
  format: combine(
    errors({ stack: true }),
    timestamp(),
    colorize(),
    customFormat
  ),
  transports: [
    new winston.transports.Console()
  ],
});
