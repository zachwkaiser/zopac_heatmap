import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Dropdown, Alert } from 'react-bootstrap';
import './style.css';

function HeatMapPage() {
  const [serverIP, setServerIP] = useState('');
  const [previousEntries, setPreviousEntries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);


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
      setServerIP('');
    }
  };

  // Handle dropdown selection
  const handleDropdownSelect = (selectedIP: string) => {
    setServerIP(selectedIP);
  };

  return (
    <Container fluid className='heatmap-page'>
      <Row className='heatmap-row'>
        <Col className='information-container' lg={3}>
          <div className='top-content'>
            <div className='button-container'>
              <Button className='info-button'>Settings</Button>
              <Button className='info-button'>Change Map</Button>
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
                      Previous
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
                        <Dropdown.Item disabled>No previous entries</Dropdown.Item>
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
                {isLoading ? 'Sending...' : 'Save'}
              </Button>
            </Form>
          </Row>
        </Col>
        <Col className='heatmap-container' lg={9}>
          <h1>Heatmap area</h1>
        </Col>
      </Row>
    </Container>
  );
}

export default HeatMapPage;
