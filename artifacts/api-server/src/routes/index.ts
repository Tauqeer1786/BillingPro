import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import customersRouter from "./customers";
import invoicesRouter from "./invoices";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import backupRouter from "./backup";
import financialYearsRouter from "./financial-years";
import purchasesRouter from "./purchases";
import authRouter from "./auth";
import usersRouter from "./users";
import businessSettingsRouter from "./business-settings";
import { authenticate, requireSalesmanPermission } from "../middleware/auth";
import { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(authenticate);

router.use(dashboardRouter);
router.use(financialYearsRouter);
router.use(backupRouter);
router.use(usersRouter);
router.use(businessSettingsRouter);
router.use(customersRouter);

const inventoryGuard = requireSalesmanPermission("canAccessInventory");
const billingGuard = requireSalesmanPermission("canBill");
const reportsGuard = requireSalesmanPermission("canViewReports");

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/purchases")) {
    return inventoryGuard(req, res, next);
  }
  next();
});
router.use(purchasesRouter);

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/reports")) {
    return reportsGuard(req, res, next);
  }
  next();
});
router.use(reportsRouter);

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/invoices") && (req.method === "POST" || req.method === "PUT" || req.method === "DELETE")) {
    return billingGuard(req, res, next);
  }
  next();
});
router.use(invoicesRouter);

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/products") && (req.method === "POST" || req.method === "PUT" || req.method === "DELETE")) {
    return inventoryGuard(req, res, next);
  }
  next();
});
router.use(productsRouter);

export default router;
