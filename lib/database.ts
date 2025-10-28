import { ObjectId } from "mongodb";

// Automation Status Document
export interface AutomationStatus {
  _id?: ObjectId;
  isRunning: boolean;
  searchNumber: string;
  lastCheck?: Date;
  nextCheck?: Date;
  lastResult?: CheckResult;
  createdAt: Date;
  updatedAt: Date;
}

// Check History Document
export interface CheckResult {
  _id?: ObjectId;
  timestamp: Date;
  pdfUrl?: string;
  searchNumber: string;
  found: boolean;
  matchCount?: number;
  error?: string;
  success: boolean;
  emailSent: boolean;
  contexts?: string[];
  source: "manual" | "cron" | "auto";
  createdAt: Date;
}

// Database service class
export class DatabaseService {
  static async getAutomationStatus(): Promise<AutomationStatus | null> {
    const { getAutomationCollection } = await import("./mongodb");
    const collection = await getAutomationCollection();

    return await collection.findOne<AutomationStatus>(
      {},
      {
        sort: { updatedAt: -1 },
      }
    );
  }

  static async upsertAutomationStatus(
    status: Partial<AutomationStatus>
  ): Promise<AutomationStatus> {
    const { getAutomationCollection } = await import("./mongodb");
    const collection = await getAutomationCollection();

    const now = new Date();
    const updateData = {
      ...status,
      updatedAt: now,
    };

    const result = await collection.findOneAndUpdate(
      {}, // Empty filter to match any document
      {
        $set: updateData,
        $setOnInsert: { createdAt: now },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    return result as AutomationStatus;
  }

  static async addCheckResult(
    result: Omit<CheckResult, "_id" | "createdAt">
  ): Promise<CheckResult> {
    const { getCheckHistoryCollection } = await import("./mongodb");
    const collection = await getCheckHistoryCollection();

    const checkResult = {
      ...result,
      createdAt: new Date(),
    };

    const insertResult = await collection.insertOne(checkResult);

    return {
      ...checkResult,
      _id: insertResult.insertedId,
    };
  }

  static async getRecentChecks(limit: number = 10): Promise<CheckResult[]> {
    const { getCheckHistoryCollection } = await import("./mongodb");
    const collection = await getCheckHistoryCollection();

    return await collection
      .find<CheckResult>({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  static async getCheckCount(): Promise<number> {
    const { getCheckHistoryCollection } = await import("./mongodb");
    const collection = await getCheckHistoryCollection();

    return await collection.countDocuments();
  }

  static async getLastCheckBySource(
    source: "manual" | "cron" | "auto"
  ): Promise<CheckResult | null> {
    const { getCheckHistoryCollection } = await import("./mongodb");
    const collection = await getCheckHistoryCollection();

    return await collection.findOne<CheckResult>(
      { source },
      { sort: { createdAt: -1 } }
    );
  }
}
