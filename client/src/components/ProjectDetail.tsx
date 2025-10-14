import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
// Sortable Ticket Component
const SortableTicket: React.FC<{
  ticket: Ticket;
  onStatusChange: (ticketId: number, newStatus: string) => void;
}> = ({ ticket, onStatusChange }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: 1,
        p: 2,
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: isDragging ? 'rotate(2deg)' : 'none',
        boxShadow: isDragging
          ? '0 8px 16px rgba(0,0,0,0.3)'
          : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
        }
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        {ticket.task}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {ticket.description}
      </Typography>
      <Chip
        label={ticket.epic_name}
        size="small"
        color="primary"
        variant="outlined"
      />
    </Card>
  );
};

// Droppable Column Component
const DroppableColumn: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        backgroundColor: isOver ? '#e3f2fd' : undefined,
        borderRadius: 1,
        minHeight: 250,
        p: 1,
        transition: 'background-color 0.2s',
      }}
    >
      {children}
    </Box>
  );
};

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
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchProjectData = useCallback(async () => {
    try {
      const [projectRes, filesRes, ticketsRes, summaryRes] = await Promise.all([
        axios.get(`/api/projects/${id}`),
        axios.get(`/api/projects/${id}/files`),
        axios.get(`/api/projects/${id}/tickets`),
        axios.get(`/api/projects/${id}/summary`).catch(() => ({ data: null })), // Handle case where no summary exists
      ]);
      
      setProject(projectRes.data);
      setFiles(filesRes.data);
      setTickets(ticketsRes.data);
      setSummary(summaryRes.data);
    } catch (err: any) {
      setError('Failed to fetch project data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id, fetchProjectData]);

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    Array.from(selectedFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      await axios.post(`/api/projects/${id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchProjectData();
      setUploadDialogOpen(false);
      setSelectedFiles(null);
    } catch (err: any) {
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
        // Refresh both files and tickets
        await fetchProjectData();
        setSuccessMessage('Tickets generated successfully!');
        console.log('Tickets generated successfully:', response.data.message);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to generate tickets';
      setError(errorMessage);
      console.error('Error generating tickets:', err.response?.data);
    } finally {
      setGeneratingTickets(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await axios.delete(`/api/files/${fileId}`);
      await fetchProjectData(); // Refresh the data
    } catch (err: any) {
      setError('Failed to delete file');
      console.error('Error deleting file:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Files selected:', event.target.files);
    setSelectedFiles(event.target.files);
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log('Drag started:', event);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('Drag end result:', event);
    
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      console.log('No drop target, drag cancelled');
      return;
    }

    const ticketId = parseInt(active.id as string);
    const newStatus = over.id as string;

    // Check if the status actually changed
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket && ticket.status === newStatus) {
      console.log('Same status, no change needed');
      return;
    }

    console.log('Dragging ticket:', ticketId, 'to status:', newStatus);

    try {
      const response = await axios.put(`/api/tickets/${ticketId}`, { status: newStatus });
      console.log('API response:', response.data);
      
      // Update local state
      setTickets(prevTickets => {
        const updatedTickets = prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: newStatus }
            : ticket
        );
        console.log('Updated tickets:', updatedTickets);
        return updatedTickets;
      });
      
      console.log('Ticket status updated successfully');
    } catch (err: any) {
      setError('Failed to update ticket status');
      console.error('Error updating ticket:', err);
    }
  };

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      await axios.put(`/api/tickets/${ticketId}`, { status: newStatus });
      setTickets(prevTickets => 
        prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: newStatus }
            : ticket
        )
      );
    } catch (err: any) {
      setError('Failed to update ticket status');
      console.error('Error updating ticket:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!project) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Project not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1">
            {project.name}
          </Typography>
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
          startIcon={generatingTickets ? <CircularProgress size={20} /> : <Refresh />}
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
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label={`Files (${files.length})`} />
            <Tab label={`Tickets (${tickets.length})`} />
          </Tabs>
        </Box>

        <CardContent>
          {activeTab === 0 && (
            <Box>
              {files.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No files uploaded yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Upload audio recordings and documents to get started
                  </Typography>
                </Box>
              ) : (
                <List>
                  {files.map((file) => (
                    <ListItem key={file.id} divider>
                      <ListItemText
                        primary={file.original_name}
                        secondary={`${file.file_type.toUpperCase()} • ${formatFileSize(file.file_size)} • ${new Date(file.uploaded_at).toLocaleString()}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          aria-label="download"
                          onClick={() => {
                            // Create download link
                            const link = document.createElement('a');
                            link.href = `/api/files/${file.id}/download`;
                            link.download = file.original_name;
                            link.click();
                          }}
                        >
                          <Download />
                        </IconButton>
                        {file.file_type === 'audio' ? (
                          <IconButton edge="end" aria-label="play">
                            <PlayArrow />
                          </IconButton>
                        ) : (
                          <a
                            href={`http://localhost:5000/api/files/${file.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex' }}
                          >
                            <IconButton
                              edge="end"
                              aria-label="view"
                              component="span"
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8a3 3 0 100 6 3 3 0 000-6z" fill="currentColor"/>
                              </svg>
                            </IconButton>
                          </a>
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
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              {/* Summary Panel */}
              {summary && (
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                    <SortableContext
                      items={['todo', 'in_progress', 'done']}
                      strategy={verticalListSortingStrategy}
                    >
                      {['todo', 'in_progress', 'done'].map((status) => {
                        const statusTickets = tickets.filter(ticket => ticket.status === status);
                        return (
                          <DroppableColumn key={status} id={status}>
                            <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                              {status.replace('_', ' ')} ({statusTickets.length})
                            </Typography>
                            <SortableContext
                              id={status}
                              items={statusTickets.map(ticket => ticket.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <Box
                                sx={{
                                  minHeight: 200,
                                  border: '2px dashed #ccc',
                                  borderRadius: 1,
                                  p: 1,
                                  backgroundColor: '#fafafa',
                                  transition: 'background-color 0.2s ease'
                                }}
                              >
                                {statusTickets.map((ticket) => (
                                  <SortableTicket
                                    key={ticket.id}
                                    ticket={ticket}
                                    onStatusChange={handleStatusChange}
                                  />
                                ))}
                              </Box>
                            </SortableContext>
                          </DroppableColumn>
                        );
                      })}
                    </SortableContext>
                  </Box>
                  <DragOverlay>
                    {activeId ? (
                      <Card sx={{ p: 2, opacity: 0.8 }}>
                        <Typography variant="subtitle2">
                          {tickets.find(t => t.id.toString() === activeId)?.task}
                        </Typography>
                      </Card>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </Box>
          )};
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
            console.log('Files dropped:', files);
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
