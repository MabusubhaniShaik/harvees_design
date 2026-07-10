import type { Request } from "express";

import RestController from "../rest.controller.ts";
import { AllocationRunModel, type IAllocationRun } from "../../models/index.ts";
import { serializeApplicationDateField } from "../../helpers/sca-controller.helper.ts";

const serializeAllocationRunRecord = <T extends { allocations?: unknown[] }>(
  record: T
): T => ({
  ...record,
  allocations: Array.isArray(record.allocations)
    ? record.allocations.map((allocation) =>
        serializeApplicationDateField(
          allocation as { application_date?: Date | string | null }
        )
      )
    : record.allocations,
});

class AllocationRunController extends RestController<IAllocationRun> {
  protected readonly model = AllocationRunModel;

  constructor() {
    super({
      tableName: "AllocationRuns",
      schema: "sca",
      lookupID: "run_code",
      searchable: true,
      orderBy: "-generated_at",
      softDelete: true,
    });
  }

  protected override getSearchFields(): string[] {
    return ["run_code", "allocations.student_id", "allocations.student_name"];
  }

  protected override async serialize(
    data: unknown,
    _request: Request
  ): Promise<unknown> {
    if (Array.isArray(data)) {
      return data.map((record) =>
        serializeAllocationRunRecord(record as { allocations?: unknown[] })
      );
    }

    return serializeAllocationRunRecord(data as { allocations?: unknown[] });
  }
}

export const allocationRunController = new AllocationRunController();
