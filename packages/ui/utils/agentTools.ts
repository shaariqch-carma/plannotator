/**
 * Agent Tools for AI Review
 *
 * Tool definitions for OpenAI function calling format.
 * These tools allow the AI reviewer to explore the codebase.
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        { type: string; description: string }
      >;
      required: string[];
    };
  };
}

export const REVIEW_AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file in the project. Use this to understand existing code that the plan will modify or interact with.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative path from project root (e.g., 'src/auth.ts', 'packages/ui/App.tsx')",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List files and folders in a directory. Use this to understand the project structure and find relevant files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative path from project root. Use '.' for the root directory.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description:
        "Search for a pattern across files in the project (like grep). Use this to find where specific functions, classes, or patterns are used.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description:
              "Regex pattern to search for (e.g., 'useAuth', 'function\\s+validate')",
          },
          glob: {
            type: "string",
            description:
              "Optional file glob pattern to filter files (e.g., '*.ts', '*.tsx')",
          },
        },
        required: ["pattern"],
      },
    },
  },
];

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

export const formatToolResult = (
  toolCallId: string,
  result: unknown
): ToolResult => ({
  tool_call_id: toolCallId,
  content: typeof result === "string" ? result : JSON.stringify(result, null, 2),
});
