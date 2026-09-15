import type { GameContext } from "../editor/gameContext";
import type { DesignSystem } from "../editor/designSystem";
import type { UISchema, GameData } from "../editor/schema";
import type { EditorOperation } from "../editor/projectOperations";
export interface UIDesignRequest {
  userMessage: string;
  selection: string[];
  gameContext: GameContext;
  designSystem: DesignSystem;
  uiSchema: UISchema;
  gameState: GameData;
}
export interface UICommandInterpreter {
  interpret(request: UIDesignRequest): Promise<EditorOperation[]>;
}
// Boundary for a future structured-operation provider; deliberately not connected to the UI.
export class DisabledAIInterpreter implements UICommandInterpreter {
  async interpret(_request: UIDesignRequest): Promise<EditorOperation[]> {
    void _request;
    throw new Error("AI command execution is not enabled.");
  }
}
