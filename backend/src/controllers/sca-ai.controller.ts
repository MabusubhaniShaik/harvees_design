import type { NextFunction, Request, Response } from "express";

import { formatSuccessResponse } from "../helpers/response-formatter.ts";
import {
  answerScaQuestion,
  getScaAiConfig,
  getScaChatHistory,
  getScaQueryHistory,
} from "../ai/sca-ai.service.ts";

export const getScaAiStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json(
      formatSuccessResponse({
        data: getScaAiConfig(),
        message: "SCA AI configuration loaded successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};

export const chatWithScaAssistant = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const message =
      typeof req.body?.message === "string" ? req.body.message : "";

    const result = await answerScaQuestion(message);

    return res.status(200).json(
      formatSuccessResponse({
        data: result,
        message: "SCA AI response generated successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getScaAiHistory = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json(
      formatSuccessResponse({
        data: await getScaQueryHistory(),
        message: "SCA AI history loaded successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getScaAiChatHistory = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json(
      formatSuccessResponse({
        data: await getScaChatHistory(),
        message: "SCA AI chat history loaded successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};
