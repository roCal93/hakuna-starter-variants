import { factories } from "@strapi/strapi";

type UID = "api::product-record.product-record";
const MODEL_UID: UID = "api::product-record.product-record";

function mergePopulate(
  queryPopulate: unknown,
  requiredPopulate: Record<string, true>
) {
  if (!queryPopulate) return requiredPopulate;
  if (queryPopulate === "*") return queryPopulate;

  if (Array.isArray(queryPopulate)) {
    return Array.from(
      new Set([...queryPopulate, ...Object.keys(requiredPopulate)])
    );
  }

  if (typeof queryPopulate === "string") {
    return Array.from(
      new Set([queryPopulate, ...Object.keys(requiredPopulate)])
    );
  }

  if (typeof queryPopulate === "object") {
    return {
      ...(queryPopulate as Record<string, unknown>),
      ...requiredPopulate,
    };
  }

  return requiredPopulate;
}

export default factories.createCoreController(MODEL_UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user as { id: number; email?: string } | null;
    if (!user) return ctx.unauthorized("Authentification requise");

    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin =
      !!adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase();
    const adminAll = ctx.query.adminAll === "true";

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = await (strapi.documents(MODEL_UID) as any).findMany({
      ...sanitizedQuery,
      ...(isAdmin && adminAll
        ? {}
        : { filters: { owner: { id: { $eq: user.id } } } }),
      populate: mergePopulate(sanitizedQuery.populate, {
        product: true,
        order: true,
        owner: true,
      }),
    });

    return { data: entries, meta: {} };
  },

  async findOne(ctx) {
    const user = ctx.state.user as { id: number; email?: string } | null;
    if (!user) return ctx.unauthorized("Authentification requise");

    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin =
      !!adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase();

    const { id } = ctx.params as { id: string };
    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await (strapi.documents(MODEL_UID) as any).findOne({
      documentId: id,
      populate: mergePopulate(sanitizedQuery.populate, {
        owner: true,
        product: true,
        order: true,
      }),
    });

    if (!entry) return ctx.notFound("Dossier produit introuvable");

    const ownerId = (entry.owner as { id: number } | null)?.id;
    if (ownerId !== user.id && !isAdmin) return ctx.forbidden("Accès refusé");

    return { data: entry };
  },

  async assignOwner(ctx) {
    const configuredAssignSecret = process.env.CLAIM_ASSIGN_SECRET;
    if (!configuredAssignSecret) {
      strapi.log.error("[product-record.assignOwner] CLAIM_ASSIGN_SECRET missing");
      return ctx.internalServerError("Configuration serveur manquante");
    }

    const providedAssignSecret = ctx.request.headers["x-claim-assign-secret"];
    const assignSecretHeader = Array.isArray(providedAssignSecret)
      ? providedAssignSecret[0]
      : providedAssignSecret;

    if (
      !assignSecretHeader ||
      typeof assignSecretHeader !== "string" ||
      assignSecretHeader !== configuredAssignSecret
    ) {
      return ctx.unauthorized("Accès refusé");
    }

    const {
      productRecordDocumentId,
      productRecordId,
      productDocumentId,
      ownerId,
      ownerDocumentId,
      ownerEmail,
      orderDocumentId,
      force,
    } = ctx.request.body as {
      productRecordDocumentId?: string;
      productRecordId?: number | string;
      productDocumentId?: string;
      ownerId?: number | string;
      ownerDocumentId?: string;
      ownerEmail?: string;
      orderDocumentId?: string;
      force?: boolean;
    };

    if (!productRecordDocumentId && !productRecordId && !productDocumentId) {
      return ctx.badRequest(
        "productRecordDocumentId, productRecordId or productDocumentId is required"
      );
    }

    if (!ownerId && !ownerDocumentId && !ownerEmail) {
      return ctx.badRequest("ownerId, ownerDocumentId or ownerEmail is required");
    }

    const parsedOwnerId =
      typeof ownerId === "string" ? Number.parseInt(ownerId, 10) : ownerId;

    let users: Array<{ id: number; documentId?: string; email?: string }> = [];
    if (typeof parsedOwnerId === "number" && Number.isInteger(parsedOwnerId)) {
      users = await strapi.query("plugin::users-permissions.user").findMany({
        where: { id: parsedOwnerId },
        limit: 1,
        select: ["id", "documentId", "email"],
      });
    } else if (ownerDocumentId) {
      users = await strapi.query("plugin::users-permissions.user").findMany({
        where: { documentId: ownerDocumentId },
        limit: 1,
        select: ["id", "documentId", "email"],
      });
    } else if (ownerEmail) {
      users = await strapi.query("plugin::users-permissions.user").findMany({
        where: { email: { $eqi: ownerEmail } },
        limit: 1,
        select: ["id", "documentId", "email"],
      });
    }

    const user = users[0] as
      | { id: number; documentId?: string; email?: string }
      | undefined;
    if (!user) {
      return ctx.send({ success: false, reason: "owner_not_found" });
    }

    const shouldForce = force !== false;
    const parsedProductRecordId =
      typeof productRecordId === "string"
        ? Number.parseInt(productRecordId, 10)
        : productRecordId;

    if (
      productRecordId !== undefined &&
      productRecordId !== null &&
      (typeof parsedProductRecordId !== "number" ||
        !Number.isInteger(parsedProductRecordId) ||
        parsedProductRecordId <= 0)
    ) {
      return ctx.badRequest("productRecordId must be a positive integer");
    }

    let productRecord:
      | { documentId: string; owner?: { id: number } | null }
      | undefined;

    if (productRecordDocumentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productRecord = await (strapi.documents(MODEL_UID) as any).findOne({
        documentId: productRecordDocumentId,
        populate: ["owner"],
      });
    } else if (
      typeof parsedProductRecordId === "number" &&
      Number.isInteger(parsedProductRecordId)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = await (strapi.documents(MODEL_UID) as any).findMany({
        filters: { id: { $eq: parsedProductRecordId } },
        populate: ["owner"],
        limit: 1,
      });
      productRecord = records[0] as
        | { documentId: string; owner?: { id: number } | null }
        | undefined;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records = await (strapi.documents(MODEL_UID) as any).findMany({
        filters: { product: { documentId: { $eq: productDocumentId } } },
        populate: ["owner"],
        limit: 1,
      });
      productRecord = records[0] as
        | { documentId: string; owner?: { id: number } | null }
        | undefined;
    }

    if (!productRecord) {
      return ctx.send({ success: false, reason: "product_record_not_found" });
    }

    const currentOwnerId = productRecord.owner?.id;
    if (currentOwnerId && currentOwnerId !== user.id && !shouldForce) {
      return ctx.send({
        success: false,
        reason: "already_assigned",
        productRecordDocumentId: productRecord.documentId,
        currentOwnerId,
      });
    }

    const updateData: Record<string, unknown> = {
      owner: user.id,
      status: "owned",
    };
    if (orderDocumentId) {
      updateData.order = { connect: [{ documentId: orderDocumentId }] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (strapi.documents(MODEL_UID) as any).update({
      documentId: productRecord.documentId,
      data: updateData,
    });

    return ctx.send({
      success: true,
      productRecordDocumentId: productRecord.documentId,
      ownerId: user.id,
      ownerDocumentId: user.documentId ?? null,
      ownerEmail: user.email ?? null,
      replacedExistingOwner:
        typeof currentOwnerId === "number" && currentOwnerId !== user.id,
    });
  },
}));
