import express from "express";
import {
  getProjects,
  getProjectById,
  addProject,
  deleteProject,
} from "../controllers/project.controller.js";
import multer from "multer";

const upload = multer();
const router = express.Router();

router.get("/", getProjects);
router.get("/:id", getProjectById);


router.post("/", upload.none(), addProject);
router.delete("/:id", deleteProject);

export default router;
