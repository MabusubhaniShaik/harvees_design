import { Router } from "express";
import multer from "multer";
import {
  uploadCsv,
  detectDataset,
  listAllTables,
  getTableDetails,
  deleteTable,
  getDashboardSummary,
  queryTable,
  exportExcel,
  exportPdf,
} from "../controllers/asa.controller.js";
import {
  chatWithAsaAssistant,
  getAsaAiChatHistory,
  getAsaAiHistory,
  getAsaAiStatus,
} from "../controllers/asa-ai.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), uploadCsv);
router.post("/detect", upload.single("file"), detectDataset);
router.get("/dashboard/summary", getDashboardSummary);
router.get("/tables", listAllTables);
router.get("/tables/:tableName", getTableDetails);
router.delete("/tables/:tableName", deleteTable);
router.post("/query", queryTable);
router.get("/ai/config", getAsaAiStatus);
router.get("/ai/history", getAsaAiHistory);
router.get("/ai/chat-history", getAsaAiChatHistory);
router.post("/ai/chat", chatWithAsaAssistant);
router.post("/export/excel", exportExcel);
router.post("/export/pdf", exportPdf);

export default router;
