import express from "express";
import {
  getProjects,
  getProjectById,
  addProject,
  deleteProject,
} from "../controllers/project.controller.js";

const router = express.Router();

router.get("/", getProjects);
router.get("/:id", getProjectById);
router.post("/", addProject);
router.delete("/:id", deleteProject);

export default router;
