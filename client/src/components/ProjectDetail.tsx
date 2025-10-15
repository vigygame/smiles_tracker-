import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  ArrowBack,
  Upload,
  PlayArrow,
  Download,
  Refresh,
  Delete,
} from '@mui/icons-material';
import axios from 'axios';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

interface File {
  id: number;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface Ticket {
  id: number;
  epic_name: string;
  task: string;
  description: string;
  status: string;
  created_at: string;
}

interface ProjectSummary {
  id: number;
  project_id: number;
  summary: string;
  created_at: string;
  updated_at: string;
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingTickets, setGeneratingTickets] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchProjectData = useCallback(async () => {
    try {
      const [projectRes, filesRes, ticketsRes, summaryRes] = await Promise.all([
        axios.get(`/api/projects/${id}`),
        axios.get(`/api/projects/${id}/files`),
        axios.get(`/api/projects/${id}/tickets`),
        axios.get(`/api/projects/${id}/summary`).catch(() => ({ data: null })),
      ]);
      setProject(projectRes.data);
      setFiles(filesRes.data);
      setTickets(ticketsRes.data);
      setSummary(summaryRes.data);
    } catch {
      setError('Failed to fetch project data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchProjectData();
  }, [id, fetchProjectData]);

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      formData.append('files', file);
    });

    try {
      await axios.post(`/api/projects/${id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchProjectData();
      setUploadDialogOpen(false);
      setSelectedFiles(null);
    } catch {
      setError('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateTickets = async () => {
    setGeneratingTickets(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post(`/api/projects/${id}/generate-tickets`);
      if (response.data.success) {
        await fetchProjectData();
        setSuccessMessage('Tickets generated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate tickets');
    } finally {
      setGeneratingTickets(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await axios.delete(`/api/files/${fileId}`);
      await fetchProjectData();
    } catch {
      setError('Failed to delete file');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Files selected:', event.target.files);
    setSelectedFiles(event.target.files);
  };

  const onDragEnd = async (result: DropResult): Promise<void> => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
  
    const ticketId = parseInt(draggableId);
    const newStatus = destination.droppableId;
  
    try {
      await axios.put(`/api/tickets/${ticketId}`, { status: newStatus });
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, status: newStatus } : t
        )
      );
    } catch {
      setError('Failed to update ticket status');
    }
  };
  

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading)
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );

  if (!project)
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Project not found</Alert>
      </Container>
    );

  const statuses = ['todo', 'in_progress', 'done'];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">{project.name}</Typography>
          <Typography variant="body1" color="text.secondary">
            {project.description || 'No description'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={() => setUploadDialogOpen(true)}
          sx={{ mr: 1 }}
        >
          Upload Files
        </Button>
        <Button
          variant="outlined"
          startIcon={
            generatingTickets ? <CircularProgress size={20} /> : <Refresh />
          }
          onClick={handleGenerateTickets}
          disabled={generatingTickets || files.length === 0}
        >
          {generatingTickets ? 'Generating...' : 'Generate Tickets'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label={`Files (${files.length})`} />
            <Tab label={`Tickets (${tickets.length})`} />
          </Tabs>
        </Box>
        <CardContent>
          {activeTab === 0 && (
            <List>
              {files.map((file) => (
                <ListItem key={file.id} divider>
                  <ListItemText
                    primary={file.original_name}
                    secondary={`${file.file_type.toUpperCase()} • ${formatFileSize(
                      file.file_size
                    )}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="download"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = `/api/files/${file.id}/download`;
                        link.download = file.original_name;
                        link.click();
                      }}
                    >
                      <Download />
                    </IconButton>
                    {file.file_type === 'audio' && (
                      <IconButton edge="end" aria-label="play">
                        <PlayArrow />
                      </IconButton>
                    )}
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleDeleteFile(file.id)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

{activeTab === 1 && summary && (
  <DragDropContext onDragEnd={onDragEnd}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 2,
      }}
    >
      {statuses.map((status) => {
        const statusTickets = tickets.filter((t) => t.status === status);

        return (
          <Droppable droppableId={status} key={status}>
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  minHeight: 200,
                  border: '2px dashed #ccc',
                  borderRadius: 1,
                  p: 1,
                  backgroundColor: snapshot.isDraggingOver
                    ? '#e3f2fd'
                    : '#fafafa',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ textTransform: 'capitalize' }}
                >
                  {status.replace('_', ' ')} ({statusTickets.length})
                </Typography>

                {statusTickets.map((ticket, index) => (
                  <Draggable
                    key={ticket.id.toString()}
                    draggableId={ticket.id.toString()}
                    index={index}
                  >
                    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{
                          mb: 1,
                          p: 2,
                          cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                          boxShadow: snapshot.isDragging
                            ? '0 8px 16px rgba(0,0,0,0.3)'
                            : '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        <Typography variant="subtitle2">
                          {ticket.task}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          paragraph
                        >
                          {ticket.description}
                        </Typography>
                        <Chip
                          label={ticket.epic_name}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Card>
                    )}
                  </Draggable>
                ))}

                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        );
      })}
    </Box>
  </DragDropContext>
)}

        </CardContent>
      </Card>

     {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Files</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Allowed file types: PDF, MD, DOC, DOCX, TXT, MP3, WAV
          </Typography>
          <Box
        sx={{
          border: '2px dashed #aaa',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          backgroundColor: '#fafbfc',
          cursor: uploading ? 'not-allowed' : 'pointer',
          mb: 2,
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: '#1976d2' }
        }}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          if (uploading) return;
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            // Merge with existing selectedFiles
            setSelectedFiles(prev => {
          if (!prev) return files;
          // Merge FileList objects into a new DataTransfer
          const dt = new DataTransfer();
          Array.from(prev).forEach(f => dt.items.add(f));
          Array.from(files).forEach(f => dt.items.add(f));
          return dt.files;
            });
          }
        }}
        onClick={() => {
          if (uploading) return;
          document.getElementById('file-upload-input')?.click();
        }}
          >
        <input
          id="file-upload-input"
          type="file"
          multiple
          accept=".pdf,.md,.doc,.docx,.txt,.mp3,.wav"
          onChange={e => {
            const files = e.target.files;
            if (files && files.length > 0) {
              setSelectedFiles(prev => {
                const dt = new DataTransfer();
                if (prev) {
                  Array.from(prev).forEach(f => dt.items.add(f));
                }
                Array.from(files).forEach(f => dt.items.add(f));
                return dt.files;
              });
              // Reset input value so the same file can be selected again if needed
              e.target.value = '';
            }
          }}
          style={{ display: 'none' }}
          disabled={uploading}
        />
        <Typography variant="body1" color="text.secondary">
          Drag &amp; drop files here, or{' '}
          <span
            style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={e => {
              e.stopPropagation();
              if (!uploading) {
                document.getElementById('file-upload-input')?.click();
              }
            }}
          >
            browse
          </span>
        </Typography>
        {selectedFiles && (
          <Box sx={{ mt: 1, textAlign: 'left' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {selectedFiles.length} file(s) selected:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
          {Array.from(selectedFiles).map((file, idx) => (
            <li key={idx} style={{ fontSize: 14, color: '#555' }}>{file.name}</li>
          ))}
            </ul>
          </Box>
        )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
        onClick={handleFileUpload}
        variant="contained"
        disabled={!selectedFiles || uploading}
          >
        {uploading ? <CircularProgress size={20} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectDetail;
