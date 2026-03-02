/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  BookOpen, 
  Users, 
  Heart, 
  ChevronRight, 
  RotateCcw, 
  LayoutDashboard, 
  Sparkles,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { QUESTIONS } from './constants';
import { MBTIType, TestResult, TeacherInsight } from './types';
import { generateStudentReport, generateTeacherInsight } from './services/gemini';

// --- Components ---

const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
    <motion.div 
      className="h-full bg-indigo-400"
      initial={{ width: 0 }}
      animate={{ width: `${(current / total) * 100}%` }}
      transition={{ duration: 0.3 }}
    />
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-3xl shadow-sm border border-indigo-50 p-6 md:p-8 ${className}`}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  className = "" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  className?: string;
}) => {
  const variants = {
    primary: 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-200',
    secondary: 'bg-emerald-400 text-white hover:bg-emerald-500 shadow-md shadow-emerald-100',
    outline: 'border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50',
    ghost: 'text-gray-500 hover:bg-gray-100'
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-2xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  const [step, setStep] = useState<'welcome' | 'test' | 'loading' | 'result' | 'teacher' | 'password'>('welcome');
  const [name, setName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({ E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 });
  const [result, setResult] = useState<TestResult | null>(null);
  const [teacherInsight, setTeacherInsight] = useState<TeacherInsight | null>(null);
  const [activeTab, setActiveTab] = useState<'school' | 'study' | 'friends' | 'encouragement'>('school');
  const [allResults, setAllResults] = useState<MBTIType[]>([]);
  const [studentList, setStudentList] = useState<{id: number, name: string, type: string}[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    // Initial fetch for all results to populate teacher view if needed
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const response = await fetch('/api/results');
      const data = await response.json();
      setStudentList(data);
      setAllResults(data.map((r: any) => r.type));
    } catch (error) {
      console.error("Failed to fetch results", error);
    }
  };

  const handleStart = () => {
    if (name.trim()) setStep('test');
  };

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [value]: answers[value] + 1 };
    setAnswers(newAnswers);

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      calculateResult(newAnswers);
    }
  };

  const calculateResult = async (finalAnswers: Record<string, number>) => {
    setStep('loading');
    
    const type = [
      finalAnswers.E >= finalAnswers.I ? 'E' : 'I',
      finalAnswers.S >= finalAnswers.N ? 'S' : 'N',
      finalAnswers.T >= finalAnswers.F ? 'T' : 'F',
      finalAnswers.J >= finalAnswers.P ? 'J' : 'P',
    ].join('');

    const report = await generateStudentReport(name, type);
    const newResult = { type, name, report };
    
    // Save to backend
    try {
      await fetch('https://script.google.com/macros/s/AKfycbyexxwusu_ohOX6IIIxcsOpN44BAQPXtsBFXobt6qEQY-Ahbk_ZU4z5D0LauQm8SkyF/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      console.log("구글 시트에 저장 완료!");
      await fetchResults();
    } catch (error) {
      console.error("Failed to save result", error);
    }

    setResult(newResult);
    setStep('result');
  };

  const handleTeacherMode = () => {
    setStep('password');
    setInputPassword('');
  };

  const verifyPassword = async () => {
    if (inputPassword === '6956') {
      setStep('loading');
      try {
        await fetchResults();
        const insight = await generateTeacherInsight(allResults);
        setTeacherInsight(insight);
        setStep('teacher');
      } catch (error) {
        alert("인사이트를 불러오는 데 실패했습니다.");
        setStep('result');
      }
    } else {
      alert("비밀번호가 틀렸습니다.");
      setInputPassword('');
    }
  };

  const clearAllData = async () => {
    if (confirm("정말로 모든 학생 데이터를 삭제하시겠습니까?")) {
      try {
        await fetch('/api/results', { method: 'DELETE' });
        await fetchResults();
        setTeacherInsight(null);
        setSelectedIds([]);
      } catch (error) {
        console.error("Failed to clear all data", error);
        alert("데이터 삭제에 실패했습니다.");
      }
    }
  };

  const deleteSelectedData = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`선택한 ${selectedIds.length}명의 데이터를 삭제하시겠습니까?`)) {
      try {
        await fetch('/api/results', { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        });
        await fetchResults();
        setSelectedIds([]);
        // Re-generate insight if there are still results
        if (allResults.length > 0) {
          const insight = await generateTeacherInsight(allResults);
          setTeacherInsight(insight);
        } else {
          setTeacherInsight(null);
        }
      } catch (error) {
        console.error("Failed to delete selected data", error);
        alert("데이터 삭제에 실패했습니다.");
      }
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === studentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(studentList.map(s => s.id));
    }
  };

  const reset = () => {
    setStep('welcome');
    setName('');
    setCurrentQuestionIndex(0);
    setAnswers({ E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 });
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-800 font-sans selection:bg-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        
        <AnimatePresence mode="wait">
          
          {/* Welcome Screen */}
          {step === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="mb-8 inline-block p-4 bg-indigo-50 rounded-3xl">
                <Sparkles className="w-12 h-12 text-indigo-500" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
                6학년 MBTI 가이드
              </h1>
              <p className="text-lg text-slate-500 mb-12">
                나를 더 잘 이해하고, 즐거운 학교생활을 위한<br />맞춤형 가이드를 만나보세요!
              </p>
              
              <Card className="mb-8">
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    이름을 알려주세요
                  </label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full px-6 py-4 rounded-2xl border-2 border-indigo-50 focus:border-indigo-200 focus:outline-none text-xl text-center transition-all"
                  />
                </div>
              </Card>

              <Button onClick={handleStart} disabled={!name.trim()} className="w-full py-5 text-xl">
                테스트 시작하기 <ChevronRight className="w-6 h-6" />
              </Button>

              <button 
                onClick={() => setStep('teacher')}
                className="mt-8 text-slate-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2 mx-auto text-sm font-medium"
              >
                <LayoutDashboard className="w-4 h-4" /> 선생님 전용 대시보드
              </button>
            </motion.div>
          )}

          {/* Test Screen */}
          {step === 'test' && (
            <motion.div 
              key="test"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                  질문 {currentQuestionIndex + 1} / {QUESTIONS.length}
                </span>
                <button onClick={reset} className="text-slate-400 hover:text-red-400">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
              
              <ProgressBar current={currentQuestionIndex + 1} total={QUESTIONS.length} />

              <Card className="min-h-[400px] flex flex-col justify-between">
                <h2 className="text-2xl font-bold text-slate-900 mb-12 leading-tight">
                  {QUESTIONS[currentQuestionIndex].text}
                </h2>
                
                <div className="space-y-4">
                  {QUESTIONS[currentQuestionIndex].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(option.value)}
                      className="w-full p-6 text-left rounded-2xl border-2 border-indigo-50 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group flex items-center justify-between"
                    >
                      <span className="text-lg font-medium text-slate-700 group-hover:text-indigo-700">
                        {option.text}
                      </span>
                      <ChevronRight className="w-5 h-5 text-indigo-200 group-hover:text-indigo-400" />
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Loading Screen */}
          {step === 'loading' && (
            <motion.div 
              key="loading"
              className="text-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto mb-8" />
              <h2 className="text-2xl font-bold text-slate-900 mb-4">AI가 분석 중이에요...</h2>
              <p className="text-slate-500">잠시만 기다려주세요. {name}님만을 위한 가이드를 만들고 있어요!</p>
            </motion.div>
          )}

          {/* Result Screen */}
          {step === 'result' && result && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-center mb-12">
                <h2 className="text-xl font-medium text-slate-500 mb-2">{name}님의 유형은</h2>
                <div className="text-6xl font-black text-indigo-500 tracking-tighter mb-4">
                  {result.type}
                </div>
                <div className="inline-block px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full font-bold text-sm">
                  #6학년_맞춤형_분석완료
                </div>
              </div>

              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                {[
                  { id: 'school', label: '학교생활', icon: User },
                  { id: 'study', label: '학습꿀팁', icon: BookOpen },
                  { id: 'friends', label: '친구관계', icon: Users },
                  { id: 'encouragement', label: '응원메시지', icon: Heart },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all ${
                      activeTab === tab.id 
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <Card className="mb-8">
                <div className="prose prose-indigo max-w-none">
                  {activeTab === 'school' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" /> 즐거운 학교생활
                      </h3>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {result.report?.schoolLife || "분석 내용을 불러오지 못했습니다."}
                      </p>
                    </div>
                  )}
                  {activeTab === 'study' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-emerald-500" /> 나만의 공부 비법
                      </h3>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {result.report?.studyTips || "분석 내용을 불러오지 못했습니다."}
                      </p>
                    </div>
                  )}
                  {activeTab === 'friends' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-400" /> 더 좋은 친구 되기
                      </h3>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {result.report?.friendships || "분석 내용을 불러오지 못했습니다."}
                      </p>
                    </div>
                  )}
                  {activeTab === 'encouragement' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 text-center py-8">
                      <Heart className="w-12 h-12 text-rose-400 mx-auto mb-6 fill-rose-50" />
                      <p className="text-2xl font-bold text-slate-800 italic leading-snug">
                        "{result.report?.encouragement || "언제나 너를 응원해!"}"
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Button onClick={reset} variant="outline">
                  <RotateCcw className="w-5 h-5" /> 다시 하기
                </Button>
                <Button onClick={handleTeacherMode} variant="secondary">
                  <LayoutDashboard className="w-5 h-5" /> 학급 분석 (교사용)
                </Button>
              </div>
            </motion.div>
          )}

          {/* Password Screen */}
          {step === 'password' && (
            <motion.div 
              key="password"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="mb-8 inline-block p-4 bg-slate-100 rounded-3xl">
                <LayoutDashboard className="w-12 h-12 text-slate-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">선생님 인증</h2>
              <p className="text-slate-500 mb-8">학급 분석을 위해 비밀번호를 입력해주세요.</p>
              
              <Card className="mb-8">
                <input 
                  type="password" 
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                  placeholder="비밀번호 4자리"
                  className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-200 focus:outline-none text-2xl text-center tracking-widest transition-all"
                  autoFocus
                />
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => setStep(result ? 'result' : 'welcome')} variant="outline">
                  취소
                </Button>
                <Button onClick={verifyPassword}>
                  확인
                </Button>
              </div>
            </motion.div>
          )}

          {/* Teacher Dashboard */}
          {step === 'teacher' && (
            <motion.div 
              key="teacher"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setStep(result ? 'result' : 'welcome')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-slate-900">학급 경영 대시보드</h2>
              </div>

              {!teacherInsight ? (
                <Card className="text-center py-12">
                  <LayoutDashboard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 mb-6">학생들의 데이터가 쌓이면<br />AI가 학급 경영 인사이트를 제공합니다.</p>
                  <Button onClick={handleTeacherMode} disabled={allResults.length === 0}>
                    지금 분석하기 ({allResults.length}명 완료)
                  </Button>
                </Card>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-6 rounded-3xl border border-indigo-50 shadow-sm">
                      <div className="text-sm font-bold text-indigo-400 mb-1">총 참여</div>
                      <div className="text-3xl font-black text-slate-800">{allResults.length}명</div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-indigo-50 shadow-sm">
                      <div className="text-sm font-bold text-emerald-400 mb-1">주요 유형</div>
                      <div className="text-3xl font-black text-slate-800">
                        {Object.entries(allResults.reduce((a, b) => ({ ...a, [b]: (a[b] || 0) + 1 }), {} as any))
                          .sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "-"}
                      </div>
                    </div>
                  </div>

                  <Card className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" /> 학생별 결과 목록
                      </h3>
                      {studentList.length > 0 && (
                        <div className="flex gap-2">
                          <button 
                            onClick={toggleSelectAll}
                            className="text-xs font-bold text-indigo-500 hover:underline"
                          >
                            {selectedIds.length === studentList.length ? '전체 해제' : '전체 선택'}
                          </button>
                          {selectedIds.length > 0 && (
                            <button 
                              onClick={deleteSelectedData}
                              className="text-xs font-bold text-red-500 hover:underline"
                            >
                              선택 삭제 ({selectedIds.length})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {studentList.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4">아직 참여한 학생이 없습니다.</p>
                      ) : (
                        studentList.map((student) => (
                          <div 
                            key={student.id} 
                            className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${
                              selectedIds.includes(student.id) ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-transparent'
                            }`}
                            onClick={() => toggleSelect(student.id)}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={selectedIds.includes(student.id)}
                                onChange={() => {}} // Handled by div onClick
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-medium text-slate-700">{student.name}</span>
                            </div>
                            <span className="font-black text-indigo-500">{student.type}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> 학기 초 분위기 조성 전략
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{teacherInsight.strategy}</p>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-emerald-600 mb-3 flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" /> 좌석 배치 가이드
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{teacherInsight.seating}</p>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-orange-500 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> 모둠 활동 구성 팁
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{teacherInsight.grouping}</p>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-rose-500 mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4" /> 학급 규칙 수립 시 고려사항
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{teacherInsight.rules}</p>
                  </Card>

                  <Button onClick={clearAllData} variant="outline" className="w-full text-red-500 border-red-100 hover:bg-red-50">
                    데이터 전체 삭제
                  </Button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
