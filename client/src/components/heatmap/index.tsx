import React, { useState } from 'react';
import { Container, Row, Col, Button, Form, Dropdown, Alert, Modal } from 'react-bootstrap';
import './style.css';

function HeatMapPage() {
  const [serverIP, setServerIP] = useState('');
  const [previousEntries, setPreviousEntries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showMapUpload, setShowMapUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);


  // API function to send data to Postman mock endpoint
  const sendToAPI = async (ip: string) => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      const response = await fetch('https://d9bbb8ed-6446-4926-a327-b313008215e9.mock.pstmn.io/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverIP: ip }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        
        // Only add to previous entries on successful API response
        setPreviousEntries(prev => {
          if (!prev.includes(ip)) {
            return [...prev, ip];
          }
          return prev;
        });
        
        setMessage({ type: 'success', text: `Server IP "${ip}" sent to API successfully!` });
      } else {
        console.error('API Error:', response.status, response.statusText);
        setMessage({ type: 'error', text: `API Error: ${response.status} ${response.statusText}` });
      }
    } catch (error) {
      console.error('Error sending data to API:', error);
      setMessage({ type: 'error', text: 'Failed to connect to server.' });
    } finally {
      setIsLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverIP.trim()) {
      sendToAPI(serverIP.trim());
    }
  };

  // Handle dropdown selection
  const handleDropdownSelect = (selectedIP: string) => {
    setServerIP(selectedIP);
  };

  // Handle file selection (store file but don't process yet)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('Selected file:', file.name);
      setSelectedFile(file);
    }
  };

  // Handle upload button click - process the selected file
  const handleUploadClick = () => {
    if (selectedFile) {
      // Check if it's an image file
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setUploadedImage(result);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        console.log('Non-image file selected:', selectedFile.name);
        // Handle PDF or other file types here if needed
      }
      
      // Close modal after upload
      setShowMapUpload(false);
    }
  };

  return (
    <Container fluid className='heatmap-page'>
      <Row className='heatmap-row'>
        <Col className='information-container' lg={3}>
          <div className='top-content'>
            <div className='button-container'>
              <Button className='info-button'>Settings</Button>
              
              <Button className='info-button' onClick={() => setShowMapUpload(true)}>Change Map</Button>
              <Modal show={showMapUpload} onHide={() => setShowMapUpload(false)} centered>
                <Modal.Header>
                  <Modal.Title>Upload Map</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Select Map File</Form.Label>
                    <Form.Control
                      type="file"
                      accept=".jpg,.pdf"
                      onChange={handleFileUpload}
                    />
                    <Form.Text className="text-muted">
                      Supported formats: JPG, PDF
                    </Form.Text>
                  </Form.Group>
                  <div className="d-flex justify-content-center gap-4">
                    <Button 
                      variant="primary" 
                      className="upload-btn"
                      onClick={handleUploadClick}
                      disabled={!selectedFile}
                    >
                      Upload Map
                    </Button>
                    <Button variant="secondary" className="cancel-btn" onClick={() => setShowMapUpload(false)}>
                      Cancel
                    </Button>
                  </div>
                </Modal.Body>
              </Modal>

            </div>
            <Row className='endpoint-info'>
              <p>Endpoint info goes here</p>
            </Row>
          </div>
          <Row className='server-ip'>
            <Form onSubmit={handleSubmit}>
              {message && (
                <Alert variant={message.type === 'success' ? 'success' : 'danger'} className="mb-3">
                  {message.text}
                </Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Server IP</Form.Label>
                <div className="input-group">
                  <Form.Control
                    type="text"
                    placeholder="Enter Server IP"
                    value={serverIP}
                    onChange={(e) => setServerIP(e.target.value)}
                    required
                  />
                  <Dropdown>
                    <Dropdown.Toggle variant="outline-secondary" id="dropdown-basic">
                      Saved Server IP's
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {previousEntries.length > 0 ? (
                        previousEntries.map((entry, index) => (
                          <Dropdown.Item 
                            key={index} 
                            onClick={() => handleDropdownSelect(entry)}
                          >
                            {entry}
                          </Dropdown.Item>
                        ))
                      ) : (
                        <Dropdown.Item className='disabled' disabled>No previous entries</Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </Form.Group>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={isLoading}
                className="w-100"
              >
                {isLoading ? 'Sending...' : 'Set Server IP'}
              </Button>
            </Form>
          </Row>
        </Col>
        <Col className='heatmap-container' lg={9} style={{
          backgroundImage: uploadedImage ? `url(${uploadedImage})` : 'none',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}>
        </Col>
      </Row>
    </Container>
  );
}

export default HeatMapPage;
