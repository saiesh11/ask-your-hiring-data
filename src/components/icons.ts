/**
 * Single icon surface for the product UI. Everything is the Untitled UI
 * "general" line set (2px stroke, 24px grid), rendered in `currentColor` —
 * i.e. monochrome foreground, never tinted with the brand colour. Swap the
 * source here and the whole app follows.
 *
 * shadcn primitives under components/ui/* keep their own lucide imports; those
 * are vendored and out of scope for this module.
 */
export {
  Plus as NewChatIcon,
  Plus as AddIcon,
  MessageChatCircle as ChatIcon,
  Stars02 as SparkIcon,
  Send01 as SendIcon,
  LayoutLeft as SidebarIcon,
  Users01 as MembersIcon,
  Settings01 as SettingsIcon,
  Building07 as OrgIcon,
  LogOut01 as SignOutIcon,
  ChevronSelectorVertical as SelectorIcon,
  X as CloseIcon,
  SearchLg as SearchIcon,
  BarChartSquare02 as BarChartIcon,
  PieChart01 as PieChartIcon,
  AlertTriangle as WarnIcon,
  TrendUp01 as TrendUpIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  ArrowLeft as BackIcon,
  ChevronLeft as CollapseIcon,
  HomeLine as HomeIcon,
  DotsHorizontal as MoreIcon,
  Edit01 as RenameIcon,
} from "@untitled-ui/icons-react";
