import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { FileText, Plus, Eye, Calendar, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface HistoryRecord {
  id: number;
  date: string;
  type: string;
  description: string;
  provider: string;
  status: 'completed' | 'pending' | 'scheduled';
}

export function MedicalHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>([
    {
      id: 1,
      date: '2026-03-01',
      type: 'PSA Test',
      description: 'Annual PSA screening - Result: 2.8 ng/mL',
      provider: 'Dr. Smith',
      status: 'completed',
    },
    {
      id: 2,
      date: '2026-02-15',
      type: 'Consultation',
      description: 'Initial consultation for prostate health assessment',
      provider: 'Dr. Johnson',
      status: 'completed',
    },
    {
      id: 3,
      date: '2025-12-10',
      type: 'Physical Exam',
      description: 'Routine physical examination',
      provider: 'Dr. Smith',
      status: 'completed',
    },
    {
      id: 4,
      date: '2026-04-05',
      type: 'Follow-up',
      description: 'Follow-up appointment scheduled',
      provider: 'Dr. Smith',
      status: 'scheduled',
    },
  ]);

  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: '',
    type: '',
    description: '',
    provider: '',
  });

  const handleAddRecord = () => {
    if (!newRecord.date || !newRecord.type || !newRecord.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    const record: HistoryRecord = {
      id: records.length + 1,
      date: newRecord.date,
      type: newRecord.type,
      description: newRecord.description,
      provider: newRecord.provider,
      status: 'completed',
    };

    setRecords([record, ...records]);
    setNewRecord({ date: '', type: '', description: '', provider: '' });
    setIsAddDialogOpen(false);
    toast.success('Medical record added successfully');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Medical History</h1>
          <p className="text-gray-600">View and manage your health records</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Record
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Medical Record</DialogTitle>
              <DialogDescription>Enter the details of your medical record</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newRecord.date}
                  onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Input
                  id="type"
                  placeholder="e.g., PSA Test, Consultation"
                  value={newRecord.type}
                  onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Enter details about the medical record"
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Healthcare Provider</Label>
                <Input
                  id="provider"
                  placeholder="e.g., Dr. Smith"
                  value={newRecord.provider}
                  onChange={(e) => setNewRecord({ ...newRecord, provider: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleAddRecord} className="flex-1">Add Record</Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent PSA</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.8 ng/mL</div>
            <p className="text-xs text-gray-500 mt-1">March 1, 2026</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next Visit</CardTitle>
            <Calendar className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Apr 5</div>
            <p className="text-xs text-gray-500 mt-1">Follow-up appointment</p>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Record History</CardTitle>
          <CardDescription>Complete list of your medical records and appointments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No medical records found. Add your first record to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{record.type}</TableCell>
                      <TableCell className="max-w-xs truncate">{record.description}</TableCell>
                      <TableCell>{record.provider || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(record.status)} variant="secondary">
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRecord(record)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Record Details</DialogTitle>
                              <DialogDescription>
                                {new Date(record.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Type</Label>
                                <p className="mt-1">{record.type}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Description</Label>
                                <p className="mt-1">{record.description}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Healthcare Provider</Label>
                                <p className="mt-1">{record.provider || 'Not specified'}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Status</Label>
                                <div className="mt-1">
                                  <Badge className={getStatusColor(record.status)} variant="secondary">
                                    {record.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
