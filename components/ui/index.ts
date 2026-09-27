/**
 * Component barrel — hanya yang dipakai, untuk menjaga ukuran bundle.
 * Sesuai PRD §21 (project structure) dan §22 (design system components).
 */

export { Button } from "./button";
export { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./card";
export { Badge, STATUS_ABSENSI, STATUS_PAYROLL, SEVERITY } from "./badge";
export { Input, Textarea, Label, Field } from "./input";
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";
export { cn } from "@/lib/utils";
export { formatRupiah, formatTanggal, formatJam, formatMenit, inisial, todayDate } from "@/lib/utils";

// Dialog
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";

// Sheet
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./sheet";
