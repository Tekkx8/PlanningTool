/*
  # Add allocation tracking fields

  1. New Fields
    - `original_quantity` (numeric): Original batch quantity before any allocations
    - `remaining_quantity` (numeric): Current remaining quantity after allocations
    - `can_reallocate` (boolean): Whether batch can be reallocated
    - `last_status_update` (timestamptz): When order status was last updated
    - `order_status` (text): Current status of the order

  2. Changes
    - Add tracking fields to allocations table
    - Add check constraints for quantities
    - Add index for faster status lookups

  3. Security
    - Maintain existing RLS policies
*/

-- Add new columns to allocations table
ALTER TABLE allocations
  ADD COLUMN original_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN remaining_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN can_reallocate boolean NOT NULL DEFAULT true,
  ADD COLUMN last_status_update timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN order_status text NOT NULL DEFAULT 'Not Released';

-- Add check constraints
ALTER TABLE allocations
  ADD CONSTRAINT check_quantities 
    CHECK (remaining_quantity >= 0 AND remaining_quantity <= original_quantity);

-- Add index for status lookups
CREATE INDEX idx_allocations_status ON allocations(order_status, can_reallocate);

-- Update trigger to track status changes
CREATE OR REPLACE FUNCTION update_allocation_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update timestamp when status changes
  IF OLD.order_status IS NULL OR NEW.order_status != OLD.order_status THEN
    NEW.last_status_update = now();
  END IF;

  -- Set reallocation flag based on status
  NEW.can_reallocate = CASE 
    WHEN NEW.order_status IN ('Finished', 'Delivered', 'Shipped', 'In delivery') THEN true
    ELSE false
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER allocation_status_update
  BEFORE UPDATE ON allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_allocation_status();