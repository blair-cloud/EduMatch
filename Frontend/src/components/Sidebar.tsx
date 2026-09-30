import React from 'react';
import {
  LayoutDashboard,
  Users,
  School,
  GitBranch,
  BarChart3,
  CheckSquare,
  Settings,
  Compass,
  ExternalLink,
  LogOut,
  Sparkles,
  Shield
} from 'lucide-react';
import { authService, UserAccount } from '../services/auth';
import { RoleBadge } from './RoleBadge';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onOpenLanding: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  pendingReviewCount: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  action?: () => void;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenLanding,
  onOpenSettings,
  onLogout,
  pendingReviewCount
}) => {
  const currentUser: UserAccount | null = authService.getCurrentUser();
  const userRole = currentUser?.role || 'Super Administrator';

  const rawNavSections: NavSection[] = [
    {
      heading: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      heading: 'Placement',
      items: [
        { id: 'students', label: userRole === 'School Administrator' ? 'Assigned Students' : 'Students', icon: Users },
        { id: 'schools', label: userRole === 'School Administrator' ? 'School Quota' : 'Schools', icon: School },
        { id: 'placement', label: 'Placements', icon: GitBranch, badge: pendingReviewCount > 0 ? pendingReviewCount : undefined }
      ]
    },
    {
      heading: 'Intelligence',
      items: [
        { id: 'responsible_ai', label: 'AI Recommendations', icon: Sparkles },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 }
      ]
    },
    {
      heading: 'Administration',
      items: [
        { id: 'users', label: 'User Management', icon: Shield },
        { id: 'acceptance', label: 'Audit & Tests', icon: CheckSquare },
        { id: 'settings', label: 'Settings', icon: Settings, action: onOpenSettings }
      ]
    }
  ];

  const filteredSections = rawNavSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => authService.hasPermission(userRole, item.id))
    }))
    .filter(section => section.items.length > 0);

  const initials = currentUser
    ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : 'AU';

  return (
    <aside className="w-60 shrink-0 bg-white text-[#475569] flex flex-col justify-between border-r border-[#E2E8F0] h-screen sticky top-0 select-none shadow-xs">
      {/* Top Branding Section */}
      <div className="p-5">
        <div className="flex items-center gap-3">
          {/* Geometric Logo [ E· ] */}
          <div className="w-8 h-8 rounded-[6px] bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm shadow-xs ring-2 ring-[#DBEAFE]">
            <span className="font-mono tracking-tighter">E·</span>
          </div>

          <div>
            <div className="text-[#172554] font-bold text-[15px] tracking-tight leading-tight flex items-center gap-1.5">
              <span>EduMatch</span>
              <span className="text-[#14B8A6] font-semibold text-xs px-1.5 py-0.2 rounded bg-[#CCFBF1] border border-[#14B8A6]/30">
                AI
              </span>
            </div>
            <div className="text-[11px] text-[#64748B] font-normal leading-tight mt-0.5">
              AI-assisted. Human-approved.
            </div>
          </div>
        </div>

        {/* Role-Filtered Navigation Groups */}
        <nav className="mt-7 space-y-5">
          {filteredSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {section.heading}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else {
                          onSelectView(item.id);
                        }
                      }}
                      className={`relative w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-[13px] font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#EFF6FF] text-[#2563EB] border-l-[3px] border-[#2563EB] rounded-l-none'
                          : 'text-[#475569] hover:text-[#2563EB] hover:bg-[#EFF6FF]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-[#D97706] text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Officer Profile & Public Page Link */}
      <div className="p-4 border-t border-[#E2E8F0] space-y-3 bg-[#FAFCFF]">
        <button
          onClick={onOpenLanding}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs font-medium text-[#475569] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Public Site</span>
          </div>
          <ExternalLink className="w-3 h-3 text-[#94A3B8]" />
        </button>

        {/* Dynamic Role-Aware Profile Card */}
        <div className="p-2.5 rounded-[6px] bg-white border border-[#E2E8F0] space-y-2 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[#172554] text-xs font-bold truncate leading-tight">
                {currentUser?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-[#64748B] font-mono truncate leading-tight mt-0.5">
                {currentUser?.email || 'admin@edumatch.rw'}
              </div>
            </div>
          </div>

          <div className="pt-0.5">
            <RoleBadge role={userRole} size="sm" />
          </div>

          <button
            onClick={onLogout}
            className="w-full mt-1 py-1 px-2 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-[4px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200"
          >
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
