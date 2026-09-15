import {
  type GameData,
  type UISchema,
  initialGameData,
} from "../editor/schema";
export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "error";
export interface EngineAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getGameState(): Promise<GameData>;
  applyUISchema(schema: UISchema): Promise<void>;
}
export class MockEngineAdapter implements EngineAdapter {
  async connect() {}
  async disconnect() {}
  async getGameState() {
    return structuredClone(initialGameData);
  }
  async applyUISchema(_schema: UISchema) {
    void _schema;
  }
}
