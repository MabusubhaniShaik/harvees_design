import { Router } from "express";

import {
  allocationRunController,
  courseController,
  getLatestAllocation,
  runAllocation,
  studentController,
} from "../controllers/sca/index.js";
import {
  chatWithScaAssistant,
  getScaAiChatHistory,
  getScaAiStatus,
  getScaAiHistory,
} from "../controllers/sca-ai.controller.js";

const router = Router();

router.get("/students", studentController.getAll);
router.post("/students", studentController.create);
router.get("/students/:student_id", studentController.getById);
router.put("/students/:student_id", studentController.update);
router.patch("/students/:student_id", studentController.update);
router.delete("/students/:student_id", studentController.remove);

router.get("/courses", courseController.getAll);
router.post("/courses", courseController.create);
router.get("/courses/:course_name", courseController.getById);
router.put("/courses/:course_name", courseController.update);
router.patch("/courses/:course_name", courseController.update);
router.delete("/courses/:course_name", courseController.remove);

router.post("/allocations/run", runAllocation);
router.get("/allocations/latest", getLatestAllocation);
router.get("/allocations", allocationRunController.getAll);
router.post("/allocations", allocationRunController.create);
router.get("/allocations/:run_code", allocationRunController.getById);
router.put("/allocations/:run_code", allocationRunController.update);
router.patch("/allocations/:run_code", allocationRunController.update);
router.delete("/allocations/:run_code", allocationRunController.remove);

router.post("/allocation-runs/run", runAllocation);
router.get("/allocation-runs/latest", getLatestAllocation);
router.get("/allocation-runs", allocationRunController.getAll);
router.post("/allocation-runs", allocationRunController.create);
router.get("/allocation-runs/:run_code", allocationRunController.getById);
router.put("/allocation-runs/:run_code", allocationRunController.update);
router.patch("/allocation-runs/:run_code", allocationRunController.update);
router.delete("/allocation-runs/:run_code", allocationRunController.remove);

router.get("/ai/config", getScaAiStatus);
router.get("/ai/history", getScaAiHistory);
router.get("/ai/chat-history", getScaAiChatHistory);
router.post("/ai/chat", chatWithScaAssistant);

export default router;
