import type { NextFunction, Request, Response } from "express";

import {
  answerAsaQuestion,
  getAsaAiConfig,
  getAsaChatHistory,
  getAsaQueryHistory,
} from "../ai/asa-ai.service.js";

export const getAsaAiStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json(getAsaAiConfig());
  } catch (error) {
    next(error);
  }
};

export const chatWithAsaAssistant = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const message =
      typeof req.body?.message === "string" ? req.body.message : "";
    const result = await answerAsaQuestion(message);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAsaAiHistory = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json(await getAsaQueryHistory());
  } catch (error) {
    next(error);
  }
};

export const getAsaAiChatHistory = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json(await getAsaChatHistory());
  } catch (error) {
    next(error);
  }
};
