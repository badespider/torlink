import { Box, Text, useInput } from "ink";
import { TextField } from "./TextField";
import { Panel } from "./Panel";
import { formatTorznabInput, parseTorznabInput } from "../../config/torznab";
import type { TorznabEndpoint } from "../../config/config";
import { COLOR, ICON } from "../theme";

interface JackettPromptProps {
  width: number;
  value: TorznabEndpoint[];
  onSubmit: (endpoints: TorznabEndpoint[]) => void;
  onCancel: () => void;
}

export function JackettPrompt({ width, value, onSubmit, onCancel }: JackettPromptProps) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" width={width}>
      <Panel title="jackett / torznab endpoint" width={width} focused height={2}>
        <Box>
          <Text color={COLOR.accent}>{`${ICON.pointer} `}</Text>
          <Box flexGrow={1} minWidth={0}>
            <TextField
              defaultValue={formatTorznabInput(value)}
              placeholder="http://127.0.0.1:9117  your-api-key"
              onSubmit={(raw) => {
                const parsed = parseTorznabInput(raw);
                onSubmit(parsed ? [parsed] : []);
              }}
            />
          </Box>
        </Box>
      </Panel>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={COLOR.alt}>↵</Text>
          <Text dimColor> save</Text>
          <Text dimColor>{`     ${ICON.dot}     `}</Text>
          <Text color={COLOR.alt}>esc</Text>
          <Text dimColor> cancel</Text>
        </Box>
        <Text dimColor>
          Jackett URL then API key (space-separated). One search fans out to every indexer you
          added there. Empty clears it.
        </Text>
      </Box>
    </Box>
  );
}
