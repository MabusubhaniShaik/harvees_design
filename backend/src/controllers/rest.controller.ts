import type { Request, Response, NextFunction } from "express";
import {
  formatFailResponse,
  formatSuccessResponse,
} from "../helpers/response-formatter.js";
import { logger, serializeError } from "../utils/logger.js";

type SaveOperation = "create" | "update";

interface HttpError extends Error {
  statusCode: number;
  details?: unknown;
}

interface MongoDuplicateKeyError extends Error {
  code: 11000;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

interface MongooseValidationError extends Error {
  errors?: Record<
    string,
    {
      path?: string;
      value?: unknown;
      message?: string;
      kind?: string;
    }
  >;
}

export interface RestControllerConfig {
  tableName: string;
  schema: string;
  lookupID: string;
  searchAble?: boolean;
  searchable?: boolean;
  orderBy?: string;
  oederBy?: string;
  softDelete?: boolean;
}

const isHttpError = (error: unknown): error is HttpError => {
  if (!(error instanceof Error)) {
    return false;
  }

  return typeof (error as Partial<HttpError>).statusCode === "number";
};

const createHttpError = (
  statusCode: number,
  message: string,
  details?: unknown
): HttpError => {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

const isDuplicateKeyError = (error: unknown): error is MongoDuplicateKeyError =>
  typeof error === "object" &&
  error !== null &&
  (error as Partial<MongoDuplicateKeyError>).code === 11000;

const formatDuplicateKeyErrors = (
  error: MongoDuplicateKeyError
): Record<string, unknown>[] => {
  const duplicateFields = Object.keys(error.keyPattern ?? error.keyValue ?? {});

  if (!duplicateFields.length) {
    return [
      {
        field: "unknown",
        message: "Duplicate value already exists.",
      },
    ];
  }

  return duplicateFields.map((field) => ({
    field,
    value: error.keyValue?.[field],
    message: `${field} already exists.`,
  }));
};

const formatValidationErrors = (
  error: MongooseValidationError
): Record<string, unknown>[] => {
  const validationErrors = Object.entries(error.errors ?? {});

  if (!validationErrors.length) {
    return [
      {
        field: "unknown",
        message: error.message || "Validation failed.",
      },
    ];
  }

  return validationErrors.map(([field, fieldError]) => ({
    field: fieldError.path ?? field,
    value: fieldError.value,
    type: fieldError.kind,
    message: fieldError.message ?? "Invalid value.",
  }));
};

export default abstract class RestController<
  TCreate extends object,
  TUpdate extends Partial<TCreate> = Partial<TCreate>,
> {
  protected readonly tableName: string;
  protected readonly schema: string;
  protected readonly lookupID: string;
  protected readonly searchAble: boolean;
  protected readonly softDelete: boolean;
  protected readonly orderBy: string | undefined;
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_PAGE_COUNT = 10;

  // Keep model untyped to avoid forcing a mongoose dependency at compile time.
  protected abstract readonly model: any;

  protected constructor(config: RestControllerConfig) {
    this.tableName = config.tableName;
    this.schema = config.schema;
    this.lookupID = config.lookupID;
    this.searchAble = config.searchAble ?? config.searchable ?? false;
    this.softDelete = config.softDelete ?? false;
    this.orderBy = config.orderBy ?? config.oederBy;
  }

  protected async preSave(
    payload: TCreate | TUpdate,
    _request: Request,
    _operation: SaveOperation
  ): Promise<TCreate | TUpdate> {
    return payload;
  }

  protected async postSave(
    response: unknown,
    _request: Request,
    _operation: SaveOperation
  ): Promise<unknown> {
    return response;
  }

  protected async serialize(data: unknown, _request: Request): Promise<unknown> {
    return data;
  }

  protected getSearchFields(): string[] {
    return [];
  }

  public readonly create = async (
    req: Request<{}, {}, TCreate>,
    res: Response,
    next: NextFunction
  ) => {
    return this.withErrorHandling(res, async () => {
      const payload = (await this.preSave(
        req.body as TCreate,
        req,
        "create"
      )) as TCreate;

      const created = await this.model.create(payload);
      const response = await this.serialize(
        await this.postSave(created, req, "create"),
        req
      );
      res.status(201).json(
        formatSuccessResponse({
          data: response,
          message: `${this.tableName} Created successfully`,
        })
      );
    }).catch(next);
  };

  public readonly getAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    return this.withErrorHandling(res, async () => {
      const query = this.buildSearchQuery(req);
      const activeFilter = this.buildActiveFilter(req);
      const mergedQuery = { ...activeFilter, ...query };
      const { page, pageCount, hasPagination } = this.getPaginationOptions(req);
      const queryBuilder = this.model.find(mergedQuery).lean();

      if (hasPagination) {
        queryBuilder.skip((page - 1) * pageCount).limit(pageCount);
      }

      if (this.orderBy) {
        queryBuilder.sort(this.orderBy);
      }

      const rawRecords = await queryBuilder.exec();
      const records = (await this.serialize(rawRecords, req)) as unknown[];

      if (!hasPagination) {
        return res.json(
          formatSuccessResponse({
            data: records,
            message: `${this.tableName} Fetched successfully`,
            totalRecordCount: rawRecords.length,
            keyValue: this.extractKeyValueFilters(req),
          })
        );
      }

      const totalCount = await this.model.countDocuments(mergedQuery).exec();
      const totalPageCount =
        totalCount > 0 ? Math.ceil(totalCount / pageCount) : 0;

      return res.json(
        formatSuccessResponse({
          data: records,
          message: `${this.tableName} Fetched successfully`,
          pagination: {
            count: pageCount,
            current_page: page,
            total_page_count: totalPageCount,
            total_record_count: totalCount,
          },
        })
      );
    }).catch(next);
  };

  public readonly getById = async (
    req: Request<{ [key: string]: string }>,
    res: Response,
    next: NextFunction
  ) => {
    return this.withErrorHandling(res, async () => {
      const lookupValue = this.getLookupValue(req);
      const identifierFilter = this.buildIdentifierFilter(lookupValue);
      const activeFilter = this.buildActiveFilter(req);
      const rawRecord = await this.model
        .findOne({ ...activeFilter, ...identifierFilter })
        .lean()
        .exec();

      if (!rawRecord) {
        throw createHttpError(404, "Record not found", {
          [this.lookupID]: lookupValue,
        });
      }

      const record = await this.serialize(rawRecord, req);

      return res.json(
        formatSuccessResponse({
          data: record,
          message: `${this.tableName} Fetched successfully`,
          pagination: {
            count: 1,
            current_page: 1,
            total_page_count: 1,
            total_record_count: 1,
          },
        })
      );
    }).catch(next);
  };

  public readonly update = async (
    req: Request<{ [key: string]: string }, {}, TUpdate>,
    res: Response,
    next: NextFunction
  ) => {
    return this.withErrorHandling(res, async () => {
      const lookupValue = this.getLookupValue(req);
      const identifierFilter = this.buildIdentifierFilter(lookupValue);
      const payload = (await this.preSave(
        req.body as TUpdate,
        req,
        "update"
      )) as TUpdate;

      const updated = await this.model
        .findOneAndUpdate(identifierFilter, payload, {
          new: true,
          runValidators: true,
          lean: true,
        })
        .exec();

      if (!updated) {
        throw createHttpError(404, "Record not found", {
          [this.lookupID]: lookupValue,
        });
      }

      const response = await this.serialize(
        await this.postSave(updated, req, "update"),
        req
      );
      return res.json(
        formatSuccessResponse({
          data: response,
            message: `${this.tableName} Updated successfully`,
          pagination: {
            count: 1,
            current_page: 1,
            total_page_count: 1,
            total_record_count: 1,
          },
        })
      );
    }).catch(next);
  };

  public readonly remove = async (
    req: Request<{ [key: string]: string }>,
    res: Response,
    next: NextFunction
  ) => {
    return this.withErrorHandling(res, async () => {
      const lookupValue = this.getLookupValue(req);
      const identifierFilter = this.buildIdentifierFilter(lookupValue);

      if (this.softDelete) {
        const updated = await this.model
          .findOneAndUpdate(identifierFilter, { is_active: false }, { new: true, lean: true })
          .exec();

        if (!updated) {
          throw createHttpError(404, "Record not found", {
            [this.lookupID]: lookupValue,
          });
        }

        return res.json(
          formatSuccessResponse({
            data: { success: true, [this.lookupID]: lookupValue },
            message: `${this.tableName} Deleted successfully`,
            pagination: {
              count: 1,
              current_page: 1,
              total_page_count: 1,
              total_record_count: 1,
            },
          })
        );
      }

      const deleted = await this.model
        .findOneAndDelete(identifierFilter)
        .lean()
        .exec();

      if (!deleted) {
        throw createHttpError(404, "Record not found", {
          [this.lookupID]: lookupValue,
        });
      }

      return res.json(
        formatSuccessResponse({
          data: { success: true, [this.lookupID]: lookupValue },
          message: `${this.tableName} Deleted successfully`,
          pagination: {
            count: 1,
            current_page: 1,
            total_page_count: 1,
            total_record_count: 1,
          },
        })
      );
    }).catch(next);
  };

  private getLookupValue(req: Request<{ [key: string]: string }>): string {
    const lookupValue = req.params[this.lookupID] ?? req.params.id;
    if (!lookupValue) {
      throw createHttpError(400, `Missing route param '${this.lookupID}'`);
    }

    return lookupValue;
  }

  private buildSearchQuery(req: Request): Record<string, unknown> {
    const query = this.normalizeQueryFilters(
      req.query as Record<string, unknown>
    );
    const idParam = query.id;
    delete query.id;
    delete query.q;
    delete query.page;
    delete query.page_count;
    delete query.limit;
    delete query.is_active;

    const queryParts: Record<string, unknown>[] = [];
    if (Object.keys(query).length > 0) {
      queryParts.push(query);
    }

    if (idParam !== undefined && idParam !== null && idParam !== "") {
      const idValue = Array.isArray(idParam) ? idParam[0] : idParam;
      queryParts.push(this.buildIdentifierFilter(String(idValue)));
    }

    if (!this.searchAble) {
      return this.combineQueryParts(queryParts);
    }

    const searchText = (req.query as Record<string, unknown>).q;
    if (typeof searchText !== "string" || !searchText.trim()) {
      return this.combineQueryParts(queryParts);
    }

    const fields = this.getSearchFields();
    if (!fields.length) {
      return this.combineQueryParts(queryParts);
    }

    queryParts.push({
      $or: fields.map((field) => ({
        [field]: { $regex: searchText.trim(), $options: "i" },
      })),
    });

    return this.combineQueryParts(queryParts);
  }

  private buildIdentifierFilter(lookupValue: string): Record<string, unknown> {
    const filters: Record<string, unknown>[] = [];
    const trimmedLookupValue = lookupValue.trim();

    if (trimmedLookupValue) {
      filters.push({ [this.lookupID]: trimmedLookupValue });
      filters.push({ id: trimmedLookupValue });

      // Accept 24-hex strings as possible Mongo ObjectId values without depending on mongoose.
      if (/^[a-fA-F0-9]{24}$/.test(trimmedLookupValue)) {
        filters.push({ _id: trimmedLookupValue });
      }

      const numericValue = Number(trimmedLookupValue);
      if (Number.isInteger(numericValue)) {
        filters.push({ id: numericValue });
      }
    }

    if (!filters.length) {
      return { [this.lookupID]: lookupValue };
    }

    return { $or: filters };
  }

  private normalizeQueryFilters(
    queryParams: Record<string, unknown>
  ): Record<string, unknown> {
    const normalizedQuery: Record<string, unknown> = {};

    Object.entries(queryParams).forEach(([key, rawValue]) => {
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        return;
      }

      if (Array.isArray(rawValue)) {
        const normalizedArray = rawValue.map((value) =>
          this.normalizeQueryValue(key, value)
        );
        normalizedQuery[key] = normalizedArray;
        return;
      }

      normalizedQuery[key] = this.normalizeQueryValue(key, rawValue);
    });

    return normalizedQuery;
  }

  private normalizeQueryValue(key: string, value: unknown): unknown {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return trimmedValue;
    }

    if (key === "_id" && /^[a-fA-F0-9]{24}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    if (key === "id") {
      const numericValue = Number(trimmedValue);
      if (Number.isInteger(numericValue)) {
        return numericValue;
      }
    }

    return trimmedValue;
  }

  private combineQueryParts(
    parts: Record<string, unknown>[]
  ): Record<string, unknown> {
    if (parts.length === 0) {
      return {};
    }

    if (parts.length === 1) {
      return parts[0]!;
    }

    return { $and: parts };
  }

  private buildActiveFilter(req: Request): Record<string, unknown> {
    if (!this.softDelete) return {};

    const rawIsActive = (req.query as Record<string, unknown>).is_active;

    if (rawIsActive === "false" || rawIsActive === false) {
      return { is_active: false };
    }

    return { is_active: true };
  }

  private getPaginationOptions(req: Request): {
    page: number;
    pageCount: number;
    hasPagination: boolean;
  } {
    const requestQuery = req.query as Record<string, unknown>;
    const hasPage = requestQuery.page !== undefined;
    const hasPageCount =
      requestQuery.page_count !== undefined || requestQuery.limit !== undefined;
    const hasPagination = hasPage || hasPageCount;
    const rawPage = Number(requestQuery.page);
    const rawPageCount = Number(requestQuery.page_count ?? requestQuery.limit);

    const page =
      Number.isInteger(rawPage) && rawPage > 0
        ? rawPage
        : RestController.DEFAULT_PAGE;
    const pageCount =
      Number.isInteger(rawPageCount) && rawPageCount > 0
        ? rawPageCount
        : RestController.DEFAULT_PAGE_COUNT;

    return { page, pageCount, hasPagination };
  }

  private extractKeyValueFilters(req: Request): Record<string, unknown> {
    const query = this.normalizeQueryFilters(
      req.query as Record<string, unknown>
    );

    delete query.page;
    delete query.page_count;
    delete query.limit;
    delete query.q;

    return query;
  }

  private async withErrorHandling(
    res: Response,
    executor: () => Promise<unknown>
  ): Promise<unknown> {
    try {
      return await executor();
    } catch (error) {
      if (isHttpError(error)) {
        logger.warn("REST controller request failed with known HTTP error", {
          event: "api.rest.http_error",
          entity: this.tableName,
          statusCode: error.statusCode,
          error: serializeError(error),
        });
        res.status(error.statusCode).json(
          formatFailResponse({
            message: error.message,
            errorMessage: error.details ? [error.details] : [],
          })
        );
        return;
      }

      if (isDuplicateKeyError(error)) {
        logger.warn("REST controller duplicate key detected", {
          event: "api.rest.duplicate_key",
          entity: this.tableName,
          statusCode: 409,
          error: serializeError(error),
        });
        res.status(409).json(
          formatFailResponse({
            message: `${this.tableName} already exists`,
            errorMessage: formatDuplicateKeyErrors(error),
          })
        );
        return;
      }

      // Generic validation error detection (works with mongoose or other libs)
      if (
        (error as any)?.name === "ValidationError" ||
        (error as any)?.errors
      ) {
        logger.warn("REST controller validation failed", {
          event: "api.rest.validation_error",
          entity: this.tableName,
          statusCode: 400,
          error: serializeError(error),
        });
        res.status(400).json(
          formatFailResponse({
            message: "Validation failed",
            errorMessage: formatValidationErrors(error as MongooseValidationError),
          })
        );
        return;
      }

      logger.error("REST controller unexpected error", {
        event: "api.rest.unexpected_error",
        entity: this.tableName,
        statusCode: 500,
        error: serializeError(error),
      });
      res.status(500).json(
        formatFailResponse({
          message: "Internal server error",
        })
      );
      return;
    }
  }
}
