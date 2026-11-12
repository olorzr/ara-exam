'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Upload, Trash2, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface WordEntry {
  word: string;
  meaning: string;
}

interface WordEntryTableProps {
  entries: WordEntry[];
  saving: boolean;
  onEntriesChange: (entries: WordEntry[]) => void;
  onSave: () => void;
  onSaveDraft: () => void;
  onLoadDraft: () => void;
}

/**
 * 단어 입력 테이블 컴포넌트 (직접 입력 + Excel 업로드)
 */
export default function WordEntryTable({
  entries, saving, onEntriesChange, onSave, onSaveDraft, onLoadDraft,
}: WordEntryTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addWordRow = () => {
    onEntriesChange([...entries, { word: '', meaning: '' }]);
  };

  const updateWord = (index: number, field: keyof WordEntry, value: string) => {
    const updated = [...entries];
    updated[index][field] = value;
    onEntriesChange(updated);
  };

  const removeWord = (index: number) => {
    if (entries.length === 1) return;
    onEntriesChange(entries.filter((_, i) => i !== index));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        const parsed: WordEntry[] = [];
        for (const row of rows) {
          const word = String(row[0] ?? '').trim();
          const meaning = String(row[1] ?? '').trim();
          if (word && meaning && word !== '단어') {
            parsed.push({ word, meaning });
          }
        }

        if (parsed.length > 0) {
          onEntriesChange(parsed);
          toast.success(`${parsed.length}개 단어를 불러왔습니다.`);
        } else {
          toast.error('유효한 단어를 찾을 수 없습니다. 양식을 확인해주세요.');
        }
      } catch {
        toast.error('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const templateData = [
      ['단어', '뜻'],
      ['사과', '과일의 한 종류'],
      ['독서', '책을 읽는 행위'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '단어 목록');
    XLSX.writeFile(wb, '단어_입력_양식.xlsx');
  };

  const validCount = entries.filter((w) => w.word.trim() && w.meaning.trim()).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">단어 목록</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onLoadDraft}>
              불러오기
            </Button>
            <Button variant="outline" size="sm" onClick={onSaveDraft}>
              <Save className="h-4 w-4 mr-1" />
              임시 저장
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual">
          <TabsList className="mb-4">
            <TabsTrigger value="manual">직접 입력</TabsTrigger>
            <TabsTrigger value="excel">Excel 업로드</TabsTrigger>
          </TabsList>

          <TabsContent value="excel">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">
                Excel 파일을 업로드하세요 (단어, 뜻 순서)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  파일 선택
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                >
                  <Download className="h-4 w-4 mr-1" />
                  양식 다운로드
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <div className="space-y-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>단어</TableHead>
                    <TableHead>뜻</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-gray-400">{idx + 1}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="단어 입력"
                          value={entry.word}
                          onChange={(e) => updateWord(idx, 'word', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="뜻 입력"
                          value={entry.meaning}
                          onChange={(e) => updateWord(idx, 'meaning', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeWord(idx)}
                          className="p-1.5 hover:text-red-500"
                          disabled={entries.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button
                variant="ghost"
                className="w-full mt-2 text-primary"
                onClick={addWordRow}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                행 추가
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">유효 단어: {validCount}개</p>
          <Button
            onClick={onSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장하기'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
