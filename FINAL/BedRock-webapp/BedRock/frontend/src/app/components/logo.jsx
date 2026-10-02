import { Box, Typography } from "@mui/material";
import svgPaths from "@/imports/svg-98zk994gne";

export function Logo({
  variant = "horizontal",
  color = "#000000",
  size = "medium",
}) {
  if (variant === "icon-only") {
    const iconSize =
      size === "small" ? 50 : size === "medium" ? 70 : 100;

    return (
      <Box
        sx={{
          width: iconSize,
          height: iconSize * 0.91,
          position: "relative",
        }}
      >
        <svg
          width="100%"
          height="100%"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 181 154.283"
          style={{ overflow: "visible" }}
        >
          <path d={svgPaths.p1ef4100} />
          <path
            d={svgPaths.p324f8880}
            stroke={color}
            strokeWidth="12"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </Box>
    );
  }

  if (variant === "large") {
    const textSize =
      size === "small"
        ? "2.5rem"
        : size === "medium"
          ? "3.5rem"
          : "4.5rem";
    const iconHeight =
      size === "small" ? 40 : size === "medium" ? 56 : 72;
    const iconWidth = iconHeight * (181 / 154.283);

    return (
      <Box
        sx={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: iconWidth,
            height: iconHeight,
            position: "relative",
          }}
        >
          <svg
            width="100%"
            height="100%"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 181 154.283"
            style={{ overflow: "visible" }}
          >
            <path d={svgPaths.p1ef4100} />
            <path
              d={svgPaths.p324f8880}
              stroke={color}
              strokeWidth="12"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </Box>
        <Typography
          sx={{
            fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontWeight: 900,
            fontSize: textSize,
            color: color,
            lineHeight: "normal",
          }}
        >
          Bedrock.
        </Typography>
      </Box>
    );
  }

  // Horizontal variant (default)
  // Calculate icon height to match text height
  const textSize =
    size === "small"
      ? "1.75rem"
      : size === "medium"
        ? "2.75rem"
        : "3.75rem";
  const iconHeight =
    size === "small" ? 28 : size === "medium" ? 44 : 60;
  const iconWidth = iconHeight * (181 / 154.283);

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: iconWidth,
          height: iconHeight,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <svg
          width="100%"
          height="100%"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 181 154.283"
          style={{ overflow: "visible" }}
        >
          <path d={svgPaths.p1ef4100} />
          <path
            d={svgPaths.p324f8880}
            stroke={color}
            strokeWidth="18"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </Box>
      <Typography
        sx={{
          fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: 900,
          fontSize: textSize,
          color: color,
          lineHeight: 1,
        }}
      >
        Bedrock.
      </Typography>
    </Box>
  );
}
