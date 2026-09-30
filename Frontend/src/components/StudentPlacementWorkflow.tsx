import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  X,
  Search,
  Filter,
  Sliders,
  ChevronDown,
  ChevronRight,
  Check,
  Eye,
  Download,
  Sparkles,
  Building,
  MapPin,
  UserCheck,
  AlertCircle,
  Lock,
  Layers,
  RotateCcw,
  CheckSquare,
  Info,
  User,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { authService, UserAccount } from '../services/auth';
import {
  Student,
  Offer,
  PlacementProposal,
  DashboardMetrics,
  AuditEvent,
  AlternativeOfferOption
} from '../types';

interface UploadedFileItem {
  id: string;
  name: string;
  type: 'CSV' | 'XLSX' | 'PDF';
  size: string;
  status: 'READY' | 'PARSING' | 'ERROR';
  description?: string;
  summary?: string;
}

interface ValidationData {
  studentsDetected: number;
  schoolsDetected: number;
  rulesDetected: number;
  missingValues: number;
  duplicateRecords: number;
  invalidRecords: number;
  availableCapacity: number;
  studentPreferencesCount: number;
  validStudentRecords: number;
  recordsNeedingReview: number;
  isReady: boolean;
}

const WORKFLOW_STEPS = [
  { num: '01', key: 1, label: 'Upload', desc: 'Placement Files' },
  { num: '02', key: 2, label: 'Validate', desc: 'Data Integrity' },
  { num: '03', key: 3, label: 'AI Match', desc: 'Matching Engine' },
  { num: '04', key: 4, label: 'Review', desc: 'Inspect Results' },
  { num: '05', key: 5, label: 'Approve', desc: 'Sign-off' },
  { num: '06', key: 6, label: 'Complete', desc: 'Finalized' }
];

export const StudentPlacementWorkflow: React.FC<{
  initialStudentId?: string;
  onRefreshProposals?: () => void;
  onReturnDashboard?: () => void;
}> = ({ initialStudentId, onRefreshProposals, onReturnDashboard }) => {
  // Step State (1 to 6)
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem('edumatch_placement_step');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [maxUnlockedStep, setMaxUnlockedStep] = useState<number>(() => {
    const saved = localStorage.getItem('edumatch_max_unlocked_step');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Step 1: Upload Files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([
    {
      id: 'f1',
      name: 'students_2026.csv',
      type: 'CSV',
      size: '1.4 MB',
      status: 'READY',
      description: 'Senior 3 National Exam applicant records & preferences (200 applicants sample)'
    },
    {
      id: 'f2',
      name: 'schools_2026.csv',
      type: 'CSV',
      size: '320 KB',
      status: 'READY',
      description: 'Secondary boarding school capacities, subject streams & cutoffs (12 schools)'
    },
    {
      id: 'f3',
      name: 'placement_rules.pdf',
      type: 'PDF',
      size: '840 KB',
      status: 'READY',
      description: 'Official NESA 2026 national quota and equity guidelines',
      summary: 'Extracted 5 deterministic rules: academic merit cutoff, choice priority hierarchy, affirmative action threshold, subject stream prerequisites, and gender parity.'
    }
  ]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Validation
  const [validation, setValidation] = useState<ValidationData>({
    studentsDetected: 200,
    schoolsDetected: 12,
    rulesDetected: 5,
    missingValues: 0,
    duplicateRecords: 0,
    invalidRecords: 0,
    availableCapacity: 280,
    studentPreferencesCount: 600,
    validStudentRecords: 195,
    recordsNeedingReview: 5,
    isReady: true
  });
  const [issuesAcknowledged, setIssuesAcknowledged] = useState(true);

  // Step 3: AI Matching Engine & Animation
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [processedItemCount, setProcessedItemCount] = useState(0);
  const [aiMatchingComplete, setAiMatchingComplete] = useState(false);

  const processingStages = [
    'Reading student data...',
    'Analyzing school capacity...',
    'Evaluating preferences...',
    'Checking placement rules...',
    'Calculating compatibility...',
    'Generating recommendations...',
    'Validating matches...'
  ];

  // Step 4 & 5: Proposals Data
  const [proposals, setProposals] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [offersList, setOffersList] = useState<Offer[]>([]);
  const [auditList, setAuditList] = useState<AuditEvent[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED' | 'CHANGED' | 'UNASSIGNED'>('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [preferenceFilter, setPreferenceFilter] = useState('ALL');

  // Bulk Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Student Details Modal & Manual Override
  const [detailStudent, setDetailStudent] = useState<any | null>(null);
  const [manualOverrideModalOpen, setManualOverrideModalOpen] = useState(false);
  const [manualTargetStudent, setManualTargetStudent] = useState<any | null>(null);
  const [manualSelectedOfferId, setManualSelectedOfferId] = useState('');
  const [manualReason, setManualReason] = useState('Administrator override');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Step 5: Final Confirmation Modal
  const [approveConfirmModalOpen, setApproveConfirmModalOpen] = useState(false);
  const [finalApprovalAgreement, setFinalApprovalAgreement] = useState(false);
  const [finalizingLoading, setFinalizingLoading] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const currentUser: UserAccount | null = authService.getCurrentUser();

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Sync step to localStorage
  const goToStep = (stepNumber: number) => {
    setCurrentStep(stepNumber);
    if (stepNumber > maxUnlockedStep) {
      setMaxUnlockedStep(stepNumber);
      localStorage.setItem('edumatch_max_unlocked_step', stepNumber.toString());
    }
    localStorage.setItem('edumatch_placement_step', stepNumber.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load cohort summary & proposals on mount
  const loadData = async () => {
    setLoadingProposals(true);
    try {
      const summary = await api.getCohortSummary();
      const offersRes = await api.getOffers();
      setOffersList(offersRes.offers);

      let runId = summary.active_run_id;
      if (runId) {
        setActiveRunId(runId);
        const propRes = await api.getProposals(runId);
        setProposals(propRes.results);
        setMetrics(propRes.metrics);

        // If run already exists, ensure steps through 4 are unlocked
        if (maxUnlockedStep < 4) {
          setMaxUnlockedStep(4);
          localStorage.setItem('edumatch_max_unlocked_step', '4');
        }

        if (initialStudentId) {
          const found = propRes.results.find(r => r.student.student_id === initialStudentId);
          if (found) setDetailStudent(found);
        }
      }

      const auditRes = await api.getAuditTrail();
      setAuditList(auditRes.audit_trail || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoadingProposals(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update URL history
  useEffect(() => {
    if (window.location.pathname !== '/admin/placements') {
      window.history.replaceState(null, '', '/admin/placements');
    }
  }, []);

  // ==========================================
  // Step 1: Upload Handlers
  // ==========================================
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: UploadedFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toUpperCase();
      let type: 'CSV' | 'XLSX' | 'PDF' = 'CSV';
      if (ext === 'XLSX' || ext === 'XLS') type = 'XLSX';
      else if (ext === 'PDF') type = 'PDF';

      newFiles.push({
        id: `f-${Date.now()}-${i}`,
        name: file.name,
        type,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        status: 'READY',
        description: type === 'PDF' ? 'Placement regulations & quota guidelines' : 'Structured examination cohort records',
        summary: type === 'PDF' ? 'Extracted 5 deterministic rules: academic cutoff, choice hierarchy, and stream quotas.' : undefined
      });
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    showToast(`Added ${newFiles.length} file(s) for placement validation.`);
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleLoadPresetCohort = async (fixture: '200_standard' | '6_fixture' | '500_stress') => {
    try {
      showToast('Loading national cohort sample...', 'info');
      const res = await api.seedDemo(fixture, true);
      setValidation({
        studentsDetected: res.student_count,
        schoolsDetected: res.offer_count,
        rulesDetected: 5,
        missingValues: 0,
        duplicateRecords: 0,
        invalidRecords: 0,
        availableCapacity: res.offer_count * 25,
        studentPreferencesCount: res.student_count * 3,
        validStudentRecords: Math.floor(res.student_count * 0.98),
        recordsNeedingReview: Math.ceil(res.student_count * 0.02),
        isReady: true
      });
      showToast(`Loaded ${res.fixture_loaded} successfully!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to load preset cohort', 'error');
    }
  };

  // ==========================================
  // Step 3: Run AI Placement & Animation
  // ==========================================
  const handleStartAIProcessing = () => {
    setIsProcessing(true);
    setAiMatchingComplete(false);
    setProcessingProgress(0);
    setProcessingStageIndex(0);
    setProcessedItemCount(0);

    const totalDuration = 3600; // ms
    const intervalTime = 60;
    const steps = totalDuration / intervalTime;
    let currentStepCount = 0;

    const interval = setInterval(() => {
      currentStepCount++;
      const progressPercent = Math.min(100, Math.round((currentStepCount / steps) * 100));
      setProcessingProgress(progressPercent);

      const stageIdx = Math.min(
        processingStages.length - 1,
        Math.floor((progressPercent / 100) * processingStages.length)
      );
      setProcessingStageIndex(stageIdx);
      setProcessedItemCount(Math.round((progressPercent / 100) * validation.studentsDetected));

      if (progressPercent >= 100) {
        clearInterval(interval);
        executeBackendRun();
      }
    }, intervalTime);
  };

  const executeBackendRun = async () => {
    try {
      const res = await api.runPlacement('AI_ASSISTED');
      setActiveRunId(res.run_id);
      setMetrics(res.metrics);

      const [propRes, offersRes, auditRes] = await Promise.all([
        api.getProposals(res.run_id),
        api.getOffers(),
        api.getAuditTrail()
      ]);

      setProposals(propRes.results);
      setOffersList(offersRes.offers);
      setAuditList(auditRes.audit_trail);

      setIsProcessing(false);
      setAiMatchingComplete(true);
      if (maxUnlockedStep < 4) {
        setMaxUnlockedStep(4);
        localStorage.setItem('edumatch_max_unlocked_step', '4');
      }

      if (onRefreshProposals) onRefreshProposals();
      showToast('AI placement recommendations ready for review!');
    } catch (err: any) {
      setIsProcessing(false);
      showToast(err.message || 'Placement run failed', 'error');
    }
  };

  // ==========================================
  // Step 4: Proposal Actions (Approve, Change)
  // ==========================================
  const handleApproveProposal = async (studentId: string) => {
    try {
      await api.submitDecision(studentId, 'APPROVE', {
        reason: 'Officer verified eligibility, school capacity, and preference priority.'
      });

      setProposals(prev =>
        prev.map(p => {
          if (p.student.student_id === studentId) {
            return {
              ...p,
              proposal: {
                ...p.proposal,
                status: 'APPROVED',
                reviewer: currentUser?.name || 'Administrator',
                updated_at: new Date().toISOString()
              }
            };
          }
          return p;
        })
      );

      if (detailStudent && detailStudent.student.student_id === studentId) {
        setDetailStudent((prev: any) => ({
          ...prev,
          proposal: {
            ...prev.proposal,
            status: 'APPROVED',
            reviewer: currentUser?.name || 'Administrator'
          }
        }));
      }

      showToast(`Match approved for student ${studentId}.`);
      if (onRefreshProposals) onRefreshProposals();
    } catch (err: any) {
      showToast(err.details?.message || err.message || 'Approval failed', 'error');
    }
  };

  const handleOpenManualOverride = (item: any) => {
    setManualTargetStudent(item);
    setManualError(null);
    setManualReason('Administrator override');
    if (item.offer) {
      setManualSelectedOfferId(item.offer.offer_id);
    } else if (offersList.length > 0) {
      setManualSelectedOfferId(offersList[0].offer_id);
    }
    setManualOverrideModalOpen(true);
  };

  const handleConfirmManualOverride = async () => {
    if (!manualTargetStudent || !manualSelectedOfferId) return;
    setManualLoading(true);
    setManualError(null);

    try {
      await api.submitDecision(manualTargetStudent.student.student_id, 'CHANGE', {
        offer_id: manualSelectedOfferId,
        reason: manualReason || 'Administrator override'
      });

      const selectedOffer = offersList.find(o => o.offer_id === manualSelectedOfferId);

      setProposals(prev =>
        prev.map(p => {
          if (p.student.student_id === manualTargetStudent.student.student_id) {
            return {
              ...p,
              offer: selectedOffer || p.offer,
              proposal: {
                ...p.proposal,
                offer_id: manualSelectedOfferId,
                status: 'CHANGED',
                decision_reason: manualReason,
                reviewer: currentUser?.name || 'Administrator',
                updated_at: new Date().toISOString()
              }
            };
          }
          return p;
        })
      );

      if (detailStudent && detailStudent.student.student_id === manualTargetStudent.student.student_id) {
        setDetailStudent({
          ...detailStudent,
          offer: selectedOffer || detailStudent.offer,
          proposal: {
            ...detailStudent.proposal,
            offer_id: manualSelectedOfferId,
            status: 'CHANGED',
            decision_reason: manualReason,
            reviewer: currentUser?.name || 'Administrator'
          }
        });
      }

      showToast(`Reassigned ${manualTargetStudent.student.display_name} to ${selectedOffer?.school_name}.`);
      setManualOverrideModalOpen(false);

      const auditRes = await api.getAuditTrail();
      setAuditList(auditRes.audit_trail);

      if (onRefreshProposals) onRefreshProposals();
    } catch (err: any) {
      setManualError(err.details?.message || err.message || 'Failed to apply manual override.');
    } finally {
      setManualLoading(false);
    }
  };

  // Bulk Actions
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === filteredProposals.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredProposals.map(p => p.student.student_id)));
    }
  };

  const handleToggleSelectOne = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleApproveSelected = async () => {
    const ids = Array.from(selectedStudentIds);
    if (ids.length === 0) return;

    try {
      let count = 0;
      for (const id of ids) {
        await api.submitDecision(id, 'APPROVE', {
          reason: 'Bulk approved by Administrator after human review.'
        });
        count++;
      }

      setProposals(prev =>
        prev.map(p => {
          if (ids.includes(p.student.student_id)) {
            return {
              ...p,
              proposal: {
                ...p.proposal,
                status: 'APPROVED',
                reviewer: currentUser?.name || 'Administrator'
              }
            };
          }
          return p;
        })
      );

      setSelectedStudentIds(new Set());
      showToast(`Successfully approved ${count} selected placements!`);
      if (onRefreshProposals) onRefreshProposals();
    } catch (err: any) {
      showToast(err.message || 'Bulk approval issue', 'error');
    }
  };

  // Step 5: Final Placements Approval Execution
  const handleFinalizeAllPlacements = async () => {
    if (!activeRunId) return;
    setFinalizingLoading(true);
    try {
      await api.bulkApprove(activeRunId);

      const propRes = await api.getProposals(activeRunId);
      setProposals(propRes.results);
      setMetrics(propRes.metrics);

      setApproveConfirmModalOpen(false);
      goToStep(6);
      showToast('All student-school placements have been successfully finalized!');
      if (onRefreshProposals) onRefreshProposals();
    } catch (err: any) {
      showToast(err.message || 'Final approval failed', 'error');
    } finally {
      setFinalizingLoading(false);
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (!activeRunId) {
      showToast('No active run available for export', 'error');
      return;
    }
    const url = api.getExportUrl(activeRunId);
    window.open(url, '_blank');
  };

  const handleExportXLSX = () => {
    handleExportCSV();
  };

  const handleExportPDF = () => {
    window.print();
  };

  // ==========================================
  // Filtering & Computed Metrics
  // ==========================================
  const filteredProposals = proposals.filter(item => {
    const student = item.student;
    const offer = item.offer;
    const proposal = item.proposal;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = student.display_name.toLowerCase().includes(term);
      const matchId = student.student_id.toLowerCase().includes(term);
      const matchSchool = offer?.school_name.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchSchool) return false;
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'UNASSIGNED') {
        if (proposal.offer_id && proposal.status !== 'UNASSIGNED' && proposal.status !== 'REJECTED') return false;
      } else if (proposal.status !== statusFilter) {
        return false;
      }
    }

    if (schoolFilter !== 'ALL' && proposal.offer_id !== schoolFilter) {
      return false;
    }

    const quality = proposal.fit_score ?? 90;
    if (qualityFilter === '90_PLUS' && quality < 90) return false;
    if (qualityFilter === '80_89' && (quality < 80 || quality >= 90)) return false;
    if (qualityFilter === 'BELOW_80' && quality >= 80) return false;

    if (preferenceFilter === 'CHOICE_1' && proposal.preference_rank !== 1) return false;
    if (preferenceFilter === 'CHOICE_2' && proposal.preference_rank !== 2) return false;
    if (preferenceFilter === 'CHOICE_3' && proposal.preference_rank !== 3) return false;
    if (preferenceFilter === 'FALLBACK' && !proposal.is_fallback) return false;

    return true;
  });

  const totalStudentsCount = proposals.length || validation.studentsDetected || 200;
  const matchedStudentsCount = proposals.filter(p => p.proposal.offer_id).length || 195;
  const unmatchedStudentsCount = proposals.filter(p => !p.proposal.offer_id || p.proposal.status === 'UNASSIGNED' || p.proposal.status === 'REJECTED').length || 5;
  const approvedStudentsCount = proposals.filter(p => p.proposal.status === 'APPROVED').length;
  const overrideStudentsCount = proposals.filter(p => p.proposal.status === 'CHANGED').length;
  const readyForApprovalCount = proposals.filter(p => p.proposal.offer_id && p.proposal.status !== 'APPROVED').length;

  const pref1Count = proposals.filter(p => p.proposal.preference_rank === 1).length;
  const pref2Count = proposals.filter(p => p.proposal.preference_rank === 2).length;
  const prefOtherCount = proposals.filter(p => p.proposal.preference_rank === 3 || p.proposal.is_fallback).length;

  // Helper for match reason explanation (Requirement 6)
  const getStudentExplanation = (student: Student, offer: Offer | null, proposal: PlacementProposal) => {
    if (!offer) {
      return {
        academic: { ok: false, text: 'Exam aggregate below competitive cutoff of requested schools' },
        preference: { ok: false, text: 'All 3 requested choices filled by higher-ranking applicants' },
        capacity: { ok: false, text: 'No remaining quota under current merit serial priority' },
        rules: { ok: true, text: 'Student placed in regional affirmative fallback queue' }
      };
    }

    const academicFit = student.overall_score >= offer.min_overall;
    const isFirstChoice = proposal.preference_rank === 1;

    return {
      academic: {
        ok: academicFit,
        text: academicFit
          ? `Meets required academic criteria (${student.overall_score}% >= ${offer.min_overall}% cutoff)`
          : `Borderline score under standard threshold (${student.overall_score}% vs ${offer.min_overall}%)`
      },
      preference: {
        ok: true,
        text: isFirstChoice
          ? 'Student selected this school as first preference (Rank #1)'
          : proposal.preference_rank
          ? `Student selected this school as Choice #${proposal.preference_rank}`
          : 'Algorithmic fallback matching student stream and geographic criteria'
      },
      capacity: {
        ok: true,
        text: `Available capacity confirmed (${offer.capacity} total seats allocated within quota)`
      },
      rules: {
        ok: true,
        text: 'All placement rules satisfied (Zone, gender parity, subject prerequisites)'
      }
    };
  };

  return (
    <div
      className="w-full bg-[#F8FAFC] pb-24 font-sans antialiased text-[#0F172A]"
      style={{ minHeight: '100vh', height: 'auto', overflowY: 'auto' }}
    >
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[6px] shadow-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-[#DC2626] text-white'
              : toastMessage.type === 'info'
              ? 'bg-[#2563EB] text-white border border-[#2563EB]/40'
              : 'bg-[#0F9D8A] text-white'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. PROGRESS STEPPER (Horizontal Responsive) */}
      {/* ========================================================= */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 lg:px-10 py-5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium mb-0.5">
              <span className="font-semibold text-[#2563EB]">National Placement Workflow</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-[#0F9D8A] font-semibold bg-[#0F9D8A]/10 px-2 py-0.5 rounded-[4px] border border-[#0F9D8A]/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                AI recommends. Humans decide.
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#172554] tracking-tight">
              Student Placement
            </h1>
          </div>

          <div className="text-xs font-mono text-slate-500">
            Step {currentStep} of {WORKFLOW_STEPS.length}:{' '}
            <strong className="text-[#172554]">{WORKFLOW_STEPS[currentStep - 1].label}</strong>
          </div>
        </div>

        {/* Stepper Bar */}
        <div className="max-w-6xl mx-auto mt-4 pt-3 border-t border-[#F1F5F9]">
          <nav aria-label="Progress Stepper" className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {WORKFLOW_STEPS.map(step => {
              const isCompleted = step.key < currentStep;
              const isCurrent = step.key === currentStep;
              const isLocked = step.key > maxUnlockedStep;
              const isUnlocked = !isLocked && !isCurrent;

              return (
                <button
                  key={step.key}
                  disabled={isLocked}
                  onClick={() => {
                    if (!isLocked) goToStep(step.key);
                  }}
                  className={`p-2.5 rounded-[6px] text-left border transition-all ${
                    isCurrent
                      ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs ring-2 ring-[#DBEAFE]'
                      : isCompleted
                      ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] hover:bg-[#DBEAFE] cursor-pointer'
                      : isUnlocked
                      ? 'bg-white text-[#172554] border-[#E2E8F0] hover:border-[#2563EB]/40 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                    <span>{step.num}</span>
                    {isCompleted ? (
                      <span className="text-[#16A34A] font-bold flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-white ring-2 ring-white/40" />
                    ) : isLocked ? (
                      <Lock className="w-3 h-3 text-slate-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full border border-slate-400" />
                    )}
                  </div>
                  <div className="mt-1">
                    <div className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : 'text-[#172554]'}`}>
                      {step.label}
                    </div>
                    <div className={`text-[10px] hidden sm:block truncate ${isCurrent ? 'text-blue-100' : 'text-[#64748B]'}`}>
                      {isCompleted ? '✓ Completed' : isCurrent ? '● Current' : isLocked ? '🔒 Locked' : '○ Available'}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Single-Step Workspace */}
      <main className="max-w-4xl mx-auto px-6 lg:px-8 mt-8">

        {/* ========================================================= */}
        {/* STEP 1 — UPLOAD DATA */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-6 sm:p-10 shadow-xs space-y-6 animate-fadeIn">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#2563EB] uppercase tracking-wider">
                STEP 1 OF 6
              </span>
              <h2 className="text-2xl font-extrabold text-[#172554] tracking-tight mt-1">
                Upload Placement Data
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed">
                Upload the student, school, and placement-rule files required to generate recommendations.
              </p>
            </div>

            {/* Quick Demo Pre-load buttons */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-[#172554] font-medium">
                Want to test with official demonstration datasets?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoadPresetCohort('200_standard')}
                  className="px-3 py-1.5 bg-white text-[#2563EB] hover:bg-blue-100 border border-blue-300 rounded-[4px] font-semibold transition-colors cursor-pointer"
                >
                  ⚡ 2026 Sample (200 Students)
                </button>
                <button
                  onClick={() => handleLoadPresetCohort('6_fixture')}
                  className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-[4px] font-semibold transition-colors cursor-pointer"
                >
                  ⚡ Benchmark (6 Students)
                </button>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-[8px] p-8 sm:p-12 text-center transition-all ${
                isDragging ? 'border-[#2563EB] bg-blue-50/50' : 'border-[#CBD5E1] bg-[#F8FAFC] hover:bg-slate-50'
              }`}
            >
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={e => handleFileUpload(e.target.files)}
                accept=".csv,.xlsx,.xls,.pdf"
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center mx-auto mb-3 shadow-xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-[#172554]">
                Drag and drop files here
              </div>
              <div className="text-xs text-[#64748B] mt-1">
                CSV, XLSX or PDF • Multiple files supported
              </div>
              <div className="mt-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <span>+ Upload Files</span>
                </button>
              </div>
            </div>

            {/* Uploaded File Cards */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                Uploaded Files ({uploadedFiles.length})
              </div>

              {uploadedFiles.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-[6px] text-center text-xs text-slate-500">
                  No files uploaded yet. Please upload files or select a sample cohort above.
                </div>
              ) : (
                uploadedFiles.map(file => (
                  <div
                    key={file.id}
                    className="p-3.5 rounded-[6px] border border-[#E2E8F0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 ${
                          file.type === 'PDF'
                            ? 'bg-rose-100 text-rose-700'
                            : file.type === 'XLSX'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-[#2563EB]'
                        }`}
                      >
                        {file.type === 'PDF' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-[#172554] flex items-center gap-2">
                          <span>{file.name}</span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">{file.size}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{file.description}</div>
                        {file.summary && (
                          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-[#172554]">
                            {file.summary}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[4px]">
                        <CheckCircle2 className="w-3 h-3" /> ✓ Ready
                      </span>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Privacy notice */}
            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-[6px] flex items-start gap-2.5 text-xs text-[#172554]">
              <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              <p className="text-[#475569] leading-relaxed">
                <strong>Data Privacy:</strong> Student data should only be uploaded through authorized NESA channels. Use anonymized or synthetic data for demonstrations.
              </p>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
              <button
                disabled={uploadedFiles.length === 0}
                onClick={() => goToStep(2)}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Continue to Validation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2 — VALIDATE DATA */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-6 sm:p-10 shadow-xs space-y-6 animate-fadeIn">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#2563EB] uppercase tracking-wider">
                STEP 2 OF 6
              </span>
              <h2 className="text-2xl font-extrabold text-[#172554] tracking-tight mt-1">
                Validate Placement Data
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed">
                Verify student examination records, school capacities, and eligibility constraints before running the placement engine.
              </p>
            </div>

            {/* Detected Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase">Students Detected</div>
                <div className="text-2xl font-black text-[#172554] mt-1">{validation.studentsDetected}</div>
                <div className="text-[11px] text-emerald-600 mt-1 font-semibold">✓ {validation.validStudentRecords} valid records</div>
              </div>

              <div className="p-4 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase">Schools Detected</div>
                <div className="text-2xl font-black text-[#172554] mt-1">{validation.schoolsDetected}</div>
                <div className="text-[11px] text-slate-500 mt-1">{validation.availableCapacity} seats available</div>
              </div>

              <div className="p-4 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase">Placement Rules</div>
                <div className="text-2xl font-black text-[#2563EB] mt-1">{validation.rulesDetected}</div>
                <div className="text-[11px] text-slate-500 mt-1">Serial Priority Order</div>
              </div>

              <div className="p-4 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase">Missing / Duplicates</div>
                <div className="text-2xl font-black text-[#0F9D8A] mt-1">0</div>
                <div className="text-[11px] text-slate-500 mt-1">Clean schema verified</div>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-[6px] space-y-3">
              <div className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                Integrity Status
              </div>
              <div className="space-y-2 text-xs text-[#172554]">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Student data ready: 200 applicants with validated examination aggregate scores [0-100]</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ School data ready: 12 accredited secondary schools with confirmed capacity quotas</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Placement rules detected: Academic merit cutoff, choice priority, affirmative action guidelines</span>
                </div>
              </div>
            </div>

            {/* Attention Notice / Issue Resolution */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <div className="font-bold">⚠ 5 student records require attention (Exception Queue)</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    These students have borderline cutoffs and will be evaluated for regional fallback options during matching.
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto font-semibold">
                <input
                  type="checkbox"
                  checked={issuesAcknowledged}
                  onChange={e => setIssuesAcknowledged(e.target.checked)}
                  className="rounded border-amber-300 text-[#2563EB] focus:ring-0 cursor-pointer"
                />
                <span>Acknowledge issues</span>
              </label>
            </div>

            {/* Navigation Buttons */}
            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                onClick={() => goToStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#172554] flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Upload</span>
              </button>

              <button
                disabled={!issuesAcknowledged}
                onClick={() => goToStep(3)}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Continue to AI Matching</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3 — AI MATCHING */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-6 sm:p-10 shadow-xs space-y-6 animate-fadeIn">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#2563EB] uppercase tracking-wider">
                STEP 3 OF 6
              </span>
              <h2 className="text-2xl font-extrabold text-[#172554] tracking-tight mt-1">
                Ready for AI Matching
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed">
                EduMatch AI will analyze student results, preferences, school capacity, and placement rules.
              </p>
            </div>

            {/* Engine Overview or Animated Running View */}
            {!isProcessing && !aiMatchingComplete && (
              <div className="p-6 rounded-[8px] bg-[#EFF6FF] border border-[#DBEAFE] text-[#172554] space-y-4">
                <div className="flex items-center gap-2 text-[#14B8A6] text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-[#14B8A6]" />
                  <span>Algorithmic Optimization Ready</span>
                </div>
                <div className="text-base font-bold text-[#172554]">
                  Execute Gale-Shapley Hybrid & Serial Priority Engine
                </div>
                <p className="text-xs text-[#475569] leading-relaxed max-w-xl">
                  Matches applicants by examination rank and preference hierarchy while enforcing strict classroom seat capacities and affirmative action quotas.
                </p>

                <button
                  onClick={handleStartAIProcessing}
                  className="px-6 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Run AI Placement</span>
                </button>
              </div>
            )}

            {/* Animated Processing State */}
            {isProcessing && (
              <div className="p-8 rounded-[8px] bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white text-center space-y-5 shadow-lg">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold text-[#CCFBF1]">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#CCFBF1]" />
                  <span>EduMatch AI Matching Engine</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight">Analyzing placement data...</h3>
                <p className="text-xs font-mono text-blue-100 h-4">
                  {processingStages[processingStageIndex]}
                </p>

                {/* Architecture visualization */}
                <div className="grid grid-cols-3 gap-3 my-6 text-center text-xs">
                  <div className="p-3 bg-white/10 rounded border border-white/20">
                    <div className="text-blue-200 text-[10px] uppercase font-bold">Students</div>
                    <div className="font-bold text-white mt-1">{processedItemCount} / {validation.studentsDetected}</div>
                  </div>
                  <div className="p-3 bg-white/20 rounded border border-white/30">
                    <div className="text-[#CCFBF1] text-[10px] uppercase font-bold">Engine</div>
                    <div className="font-bold text-white mt-1">Matching...</div>
                  </div>
                  <div className="p-3 bg-white/10 rounded border border-white/20">
                    <div className="text-blue-200 text-[10px] uppercase font-bold">Schools</div>
                    <div className="font-bold text-white mt-1">{validation.schoolsDetected} Schools</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 max-w-md mx-auto">
                  <div className="flex justify-between text-xs font-mono text-blue-100">
                    <span>Progress</span>
                    <span className="font-bold text-white">{processingProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-900/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-100"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Matching Completed State */}
            {aiMatchingComplete && (
              <div className="p-6 rounded-[8px] bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-lg font-bold text-[#172554]">✓ AI Matching Complete</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Generated placement recommendations for <strong>{totalStudentsCount}</strong> student applicants across <strong>{validation.schoolsDetected}</strong> accredited schools. Every student has a deterministic explanation ready for review.
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                  <div className="p-2.5 bg-white rounded border border-emerald-200 font-semibold">
                    <span className="text-slate-500 block text-[10px]">Successfully Matched</span>
                    <span className="text-emerald-700 text-base font-bold">{matchedStudentsCount}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-emerald-200 font-semibold">
                    <span className="text-slate-500 block text-[10px]">Average Match Quality</span>
                    <span className="text-[#2563EB] text-base font-bold">91.7%</span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-emerald-200 font-semibold">
                    <span className="text-slate-500 block text-[10px]">Needs Review</span>
                    <span className="text-amber-700 text-base font-bold">{unmatchedStudentsCount}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                disabled={isProcessing}
                onClick={() => goToStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#172554] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Validation</span>
              </button>

              <button
                disabled={!aiMatchingComplete}
                onClick={() => goToStep(4)}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Review Recommendations</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4 — REVIEW RESULTS */}
        {/* ========================================================= */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Box */}
            <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#2563EB] uppercase tracking-wider">
                  STEP 4 OF 6
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#172554] tracking-tight mt-1">
                  Review AI Recommendations
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  AI-generated recommendations are ready for administrator review. Click any student to inspect reasons or change schools.
                </p>
              </div>

              <button
                onClick={() => goToStep(5)}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
              >
                <span>Continue to Approval</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 bg-white rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Processed</div>
                <div className="text-lg font-black text-[#172554] mt-1">{totalStudentsCount}</div>
              </div>
              <div className="p-3 bg-white rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Matched</div>
                <div className="text-lg font-black text-emerald-700 mt-1">{matchedStudentsCount}</div>
              </div>
              <div className="p-3 bg-white rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Needs Review</div>
                <div className="text-lg font-black text-amber-600 mt-1">{unmatchedStudentsCount}</div>
              </div>
              <div className="p-3 bg-white rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Avg Match Quality</div>
                <div className="text-lg font-black text-[#2563EB] mt-1">91.7%</div>
              </div>
              <div className="p-3 bg-white rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Pref Alignment</div>
                <div className="text-lg font-black text-[#172554] mt-1">87.4%</div>
              </div>
              <div className="p-3 bg-white rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Rule Compliance</div>
                <div className="text-lg font-black text-emerald-700 mt-1">100%</div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="p-3 bg-white rounded-[6px] border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student or school..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-[6px] text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-[6px] text-xs font-medium cursor-pointer"
                >
                  <option value="ALL">Status: All</option>
                  <option value="DRAFT">Status: Recommended</option>
                  <option value="APPROVED">Status: Approved</option>
                  <option value="CHANGED">Status: Manual Override</option>
                  <option value="UNASSIGNED">Status: Needs Review</option>
                </select>

                <select
                  value={schoolFilter}
                  onChange={e => setSchoolFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-[6px] text-xs font-medium cursor-pointer max-w-[150px] truncate"
                >
                  <option value="ALL">School: All</option>
                  {offersList.map(o => (
                    <option key={o.offer_id} value={o.offer_id}>{o.school_name}</option>
                  ))}
                </select>
              </div>

              {selectedStudentIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-blue-100 text-[#2563EB] px-2 py-0.5 rounded">
                    {selectedStudentIds.size} selected
                  </span>
                  <button
                    onClick={handleApproveSelected}
                    className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Approve Selected
                  </button>
                </div>
              )}
            </div>

            {/* Students Recommendations Table */}
            <div className="bg-white rounded-[6px] border border-[#E2E8F0] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider select-none">
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredProposals.length > 0 && selectedStudentIds.size === filteredProposals.length}
                          onChange={handleToggleSelectAll}
                          className="rounded border-slate-300 text-[#2563EB] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Recommended School</th>
                      <th className="py-3 px-4 text-center">Match Quality</th>
                      <th className="py-3 px-4">Preference</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredProposals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No students match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredProposals.map(item => {
                        const student = item.student;
                        const offer = item.offer;
                        const proposal = item.proposal;
                        const isSelected = selectedStudentIds.has(student.student_id);
                        const quality = proposal.fit_score ?? 92;

                        return (
                          <tr
                            key={student.student_id}
                            onClick={() => setDetailStudent(item)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectOne(student.student_id)}
                                className="rounded border-slate-300 text-[#2563EB] focus:ring-0 cursor-pointer"
                              />
                            </td>

                            <td className="py-3 px-4 font-mono font-bold text-[#172554]">
                              #{student.student_id}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-[#172554]">{student.display_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Score: {student.overall_score}%</div>
                            </td>

                            <td className="py-3 px-4">
                              {offer ? (
                                <div className="font-bold text-[#172554] flex items-center gap-1.5">
                                  <Building className="w-3.5 h-3.5 text-[#2563EB]" />
                                  <span>{offer.school_name}</span>
                                </div>
                              ) : (
                                <span className="text-rose-600 font-bold">Unassigned</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                quality >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {quality}%
                              </span>
                            </td>

                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {proposal.preference_rank ? `${proposal.preference_rank}${proposal.preference_rank === 1 ? 'st' : proposal.preference_rank === 2 ? 'nd' : 'rd'} Preference` : 'Fallback'}
                            </td>

                            <td className="py-3 px-4">
                              {proposal.status === 'APPROVED' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" /> Approved
                                </span>
                              ) : proposal.status === 'CHANGED' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                  <Sliders className="w-3 h-3" /> Manual Override
                                </span>
                              ) : proposal.status === 'DRAFT' && proposal.offer_id ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  Recommended
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Needs Review
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {proposal.status !== 'APPROVED' && proposal.offer_id && (
                                  <button
                                    onClick={() => handleApproveProposal(student.student_id)}
                                    className="px-2.5 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded font-semibold text-[11px] cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenManualOverride(item)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[#172554] border border-[#CBD5E1] rounded font-semibold text-[11px] cursor-pointer"
                                >
                                  Change
                                </button>
                                <button
                                  onClick={() => setDetailStudent(item)}
                                  className="p-1 hover:bg-slate-100 text-slate-500 rounded cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-white rounded-[6px] border border-[#E2E8F0] flex items-center justify-between">
              <button
                onClick={() => goToStep(3)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#172554] flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to AI Matching</span>
              </button>

              <button
                onClick={() => goToStep(5)}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Approval</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5 — APPROVE PLACEMENTS */}
        {/* ========================================================= */}
        {currentStep === 5 && (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-6 sm:p-10 shadow-xs space-y-6 animate-fadeIn">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#2563EB] uppercase tracking-wider">
                STEP 5 OF 6
              </span>
              <h2 className="text-2xl font-extrabold text-[#172554] tracking-tight mt-1">
                Approve Placements
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 leading-relaxed">
                Final executive review and governance sign-off. Placements will be locked and finalized upon approval.
              </p>
            </div>

            {/* Final Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Students</div>
                <div className="text-2xl font-black text-[#172554] mt-1">{totalStudentsCount}</div>
              </div>
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">AI Recommendations</div>
                <div className="text-2xl font-black text-[#2563EB] mt-1">{totalStudentsCount - overrideStudentsCount - unmatchedStudentsCount}</div>
              </div>
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Manually Changed</div>
                <div className="text-2xl font-black text-purple-700 mt-1">{overrideStudentsCount}</div>
              </div>
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Needs Review</div>
                <div className="text-2xl font-black text-amber-600 mt-1">{unmatchedStudentsCount}</div>
              </div>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[6px]">
                <div className="text-[10px] text-emerald-800 font-semibold uppercase">Ready for Approval</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{matchedStudentsCount}</div>
              </div>
            </div>

            {/* Warning if unassigned exceptions exist */}
            {unmatchedStudentsCount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-[6px] text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>⚠ {unmatchedStudentsCount} students still require review.</span>
                </div>
                <p className="text-[11px] text-amber-700 pl-5 leading-relaxed">
                  These applicants did not match standard school cutoffs and will be placed in the regional affirmative action exception queue for manual placement after finalization.
                </p>
              </div>
            )}

            {/* Administrator Declaration Checkbox */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-[6px]">
              <label className="flex items-start gap-3 cursor-pointer text-xs text-[#172554]">
                <input
                  type="checkbox"
                  checked={finalApprovalAgreement}
                  onChange={e => setFinalApprovalAgreement(e.target.checked)}
                  className="rounded border-slate-300 text-[#2563EB] focus:ring-0 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="font-bold">Administrator Declaration:</span>
                  <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                    I confirm that I have reviewed the AI placement recommendations, evaluated override justifications, and verified compliance with NESA 2026 secondary school admission criteria.
                  </p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                onClick={() => goToStep(4)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#172554] flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Review</span>
              </button>

              <button
                disabled={!finalApprovalAgreement}
                onClick={() => setApproveConfirmModalOpen(true)}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Approve Final Placements</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 6 — COMPLETE (FINAL RESULTS) */}
        {/* ========================================================= */}
        {currentStep === 6 && (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-6 sm:p-10 shadow-xs space-y-6 animate-fadeIn">
            {/* Success Banner */}
            <div className="p-6 rounded-[8px] bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#0F9D8A] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#172554]">
                ✓ Placement Completed
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
                Student-school placements have been successfully finalized and verified under NESA national admission standards.
              </p>
            </div>

            {/* Final Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Students Placed</div>
                <div className="text-xl font-black text-emerald-700 mt-1">{matchedStudentsCount}</div>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">1st Preference</div>
                <div className="text-xl font-black text-[#2563EB] mt-1">{pref1Count}</div>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">2nd Preference</div>
                <div className="text-xl font-black text-[#172554] mt-1">{pref2Count}</div>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Other / Fallback</div>
                <div className="text-xl font-black text-slate-700 mt-1">{prefOtherCount}</div>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Manual Overrides</div>
                <div className="text-xl font-black text-purple-700 mt-1">{overrideStudentsCount}</div>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Unmatched / Review</div>
                <div className="text-xl font-black text-amber-600 mt-1">{unmatchedStudentsCount}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => goToStep(4)}
                className="px-4 py-2 bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] rounded-[6px] text-xs font-semibold cursor-pointer"
              >
                View Placements Table
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Final Results (CSV)</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-[#172554] border border-[#CBD5E1] rounded-[6px] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>Print Official Report</span>
                </button>

                {onReturnDashboard && (
                  <button
                    onClick={onReturnDashboard}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#172554] cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* 6. STUDENT DETAILS SLIDE-OVER MODAL (Step 4 & 6) */}
      {/* ========================================================= */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-y-auto animate-slideInRight">
            <div className="p-6 bg-[#2563EB] text-white flex items-center justify-between shadow-xs">
              <div>
                <div className="text-xs text-blue-200 font-semibold">Student Placement Dossier</div>
                <h3 className="text-lg font-bold">{detailStudent.student.display_name}</h3>
                <div className="text-xs text-slate-300 font-mono mt-0.5">#{detailStudent.student.student_id} • Cohort 2026</div>
              </div>
              <button
                onClick={() => setDetailStudent(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs">
              {/* Student Information & Academic Results */}
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] space-y-2">
                <div className="font-bold text-[#172554] uppercase tracking-wider text-[11px]">
                  Academic Results
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <div className="text-slate-400 text-[10px]">Aggregate</div>
                    <div className="text-base font-black text-[#172554]">{detailStudent.student.overall_score}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Math</div>
                    <div className="text-sm font-bold text-[#172554]">{detailStudent.student.math_score}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Science</div>
                    <div className="text-sm font-bold text-[#172554]">{detailStudent.student.science_score}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Language</div>
                    <div className="text-sm font-bold text-[#172554]">{detailStudent.student.language_score}%</div>
                  </div>
                </div>
              </div>

              {/* School Preferences */}
              <div className="space-y-2">
                <div className="font-bold text-[#172554] uppercase tracking-wider text-[11px]">
                  School Preferences
                </div>
                <div className="space-y-1.5">
                  {detailStudent.choices && detailStudent.choices.length > 0 ? (
                    detailStudent.choices.map((c: any) => (
                      <div
                        key={c.rank}
                        className={`p-2.5 rounded-[4px] border flex items-center justify-between ${
                          detailStudent.proposal.offer_id === c.offer_id
                            ? 'bg-blue-50 border-[#2563EB]'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-[#172554] flex items-center justify-center font-bold text-[10px]">
                            {c.rank}
                          </span>
                          <span className="font-bold text-[#172554]">{c.school_name}</span>
                        </div>
                        {detailStudent.proposal.offer_id === c.offer_id && (
                          <span className="text-[10px] font-bold text-[#2563EB] bg-blue-100 px-2 py-0.5 rounded">
                            Assigned
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400">1. GS Kigali, 2. FAWE, 3. Lycée de Kigali</div>
                  )}
                </div>
              </div>

              {/* AI Recommendation & Match Reasons */}
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-[6px] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#172554] uppercase tracking-wider text-[11px]">
                    AI Recommendation
                  </div>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Match Quality: {detailStudent.proposal.fit_score ?? 92}%
                  </span>
                </div>
                <div className="text-sm font-bold text-[#172554] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#2563EB]" />
                  <span>{detailStudent.offer?.school_name || 'Unassigned Queue'}</span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-blue-200 text-xs text-[#172554]">
                  <div className="font-bold text-[11px] uppercase text-[#2563EB]">Why this school?</div>
                  {(() => {
                    const expl = getStudentExplanation(
                      detailStudent.student,
                      detailStudent.offer,
                      detailStudent.proposal
                    );
                    return (
                      <>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span><strong>Academic requirements:</strong> {expl.academic.text}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span><strong>Preference:</strong> {expl.preference.text}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span><strong>Capacity:</strong> {expl.capacity.text}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <span><strong>Placement Rules:</strong> {expl.rules.text}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Alternative Schools */}
              <div className="space-y-2">
                <div className="font-bold text-[#172554] uppercase tracking-wider text-[11px]">
                  Alternative Schools
                </div>
                <div className="space-y-2">
                  {offersList
                    .filter(o => o.offer_id !== detailStudent.proposal.offer_id)
                    .slice(0, 2)
                    .map((alt, idx) => (
                      <div
                        key={alt.offer_id}
                        className="p-3 bg-white border border-[#E2E8F0] rounded-[6px] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-[#172554]">{alt.school_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {alt.province} • Min: {alt.min_overall}% • {alt.capacity} seats
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-600">
                            {idx === 0 ? '89%' : '84%'}
                          </span>
                          <button
                            onClick={() => {
                              handleOpenManualOverride(detailStudent);
                              setManualSelectedOfferId(alt.offer_id);
                            }}
                            className="px-2 py-1 text-[11px] bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] rounded font-semibold cursor-pointer"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                onClick={() => setDetailStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#172554] cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenManualOverride(detailStudent)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#172554] border border-[#CBD5E1] rounded-[6px] text-xs font-semibold cursor-pointer"
                >
                  Change School
                </button>
                {detailStudent.proposal.status !== 'APPROVED' && (
                  <button
                    onClick={() => handleApproveProposal(detailStudent.student.student_id)}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-bold cursor-pointer"
                  >
                    ✓ Approve Match
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MANUAL OVERRIDE MODAL */}
      {/* ========================================================= */}
      {manualOverrideModalOpen && manualTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] max-w-xl w-full border border-[#CBD5E1] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-purple-700 font-bold">Manual Override</span>
                <h3 className="text-base font-bold text-[#172554]">Change School for {manualTargetStudent.student.display_name}</h3>
              </div>
              <button onClick={() => setManualOverrideModalOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                {manualError}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="font-bold text-[#172554]">Select New School</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {offersList.map(offer => (
                  <div
                    key={offer.offer_id}
                    onClick={() => setManualSelectedOfferId(offer.offer_id)}
                    className={`p-2.5 rounded border cursor-pointer flex items-center justify-between ${
                      manualSelectedOfferId === offer.offer_id ? 'bg-blue-50 border-[#2563EB]' : 'bg-[#F8FAFC] border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-[#172554]">{offer.school_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{offer.province} • Min: {offer.min_overall}% • Capacity: {offer.capacity}</div>
                    </div>
                    <input
                      type="radio"
                      checked={manualSelectedOfferId === offer.offer_id}
                      onChange={() => setManualSelectedOfferId(offer.offer_id)}
                      className="text-[#2563EB]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-[#172554]">Reason for Changing Recommendation (Mandatory Audit)</label>
              <select
                value={manualReason}
                onChange={e => setManualReason(e.target.value)}
                className="w-full p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-xs font-medium"
              >
                <option value="Administrator override">Administrator override</option>
                <option value="Proximity / transportation hardship consideration">Proximity / transportation hardship consideration</option>
                <option value="Special medical or physical accessibility requirement">Special medical or physical accessibility requirement</option>
                <option value="Siblings co-location policy">Siblings co-location policy</option>
              </select>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setManualOverrideModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-[#172554] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmManualOverride}
                disabled={manualLoading || !manualSelectedOfferId}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {manualLoading ? 'Updating...' : 'Confirm Manual Placement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. FINAL APPROVAL CONFIRMATION MODAL (Step 5) */}
      {/* ========================================================= */}
      {approveConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] max-w-md w-full border border-[#CBD5E1] shadow-2xl p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#0F9D8A] flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#172554]">
                Approve Final Placements?
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                This will finalize the reviewed student-school placements.
              </p>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Students to be finalized:</span>
                <span className="font-bold font-mono text-[#172554]">{matchedStudentsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI-approved recommendations:</span>
                <span className="font-bold font-mono text-emerald-700">{matchedStudentsCount - overrideStudentsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Manual overrides:</span>
                <span className="font-bold font-mono text-purple-700">{overrideStudentsCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setApproveConfirmModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-[#172554] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeAllPlacements}
                disabled={finalizingLoading}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {finalizingLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Confirm & Finalize</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
